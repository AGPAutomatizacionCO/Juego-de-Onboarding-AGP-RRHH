import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

// Mapa local (1-5, el que usan las pantallas de isla) -> prefijo de las
// claves de AsyncStorage. Mismo orden en las 9 islas: Visual, Lectura,
// Recordemos, Social, Evaluacion.
const PREFIJOS: Record<number, string> = {
  1: "visual",
  2: "lectura",
  3: "recordemos",
  4: "social",
  5: "evaluacion",
};

// Cada isla tiene exactamente 5 niveles y las NIVELES_KEY son consecutivas
// por isla (isla 1 = 1-5, isla 2 = 6-10, isla 3 = 11-15, ...), verificado
// contra el catalogo real de Azure. Con eso se calcula la llave real sin
// tener que tocar cada pantalla de nivel para que la reporte.
function nivelKeyReal(islaKey: number, nivelIdLocal: number): number {
  return (islaKey - 1) * 5 + nivelIdLocal;
}

// Numero de nivel con el que cada pantalla guarda sus marcas locales
// (isla{I}_nivel{N}_{tipo}_done). Todas las islas usan la NIVELES_KEY real
// (p.ej. isla7_nivel31_visual_done) salvo HSE (isla 2), cuyas pantallas y mapa
// usan el numero local 1-5 (isla2_nivel1_visual_done).
function nivelEnClaveLocal(islaKey: number, nivelIdLocal: number): number {
  return islaKey === 2 ? nivelIdLocal : nivelKeyReal(islaKey, nivelIdLocal);
}

/**
 * Si el administrador habilito el reintento para este nivel, lo consume
 * (no vuelve a quedar habilitado solo), borra el resultado guardado local
 * (done/score) para que la pantalla del nivel se muestre como si nunca se
 * hubiera jugado, y devuelve true para que el llamador deje pasar al
 * usuario. El conteo de intentos (INTENTO) no se toca aqui - lo incrementa
 * el propio nivel al guardar el resultado nuevo.
 *
 * Devuelve false si no hay reintento habilitado (o si algo fallo al
 * consultar) - en ese caso el llamador debe mantener el bloqueo normal de
 * "nivel ya completado".
 */
export async function intentarConsumirReintento(
  usuarioKey: number,
  islaKey: number,
  nivelIdLocal: number
): Promise<boolean> {
  const nivelKey = nivelKeyReal(islaKey, nivelIdLocal);

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/niveles/evaluacionFinal/resultado/${usuarioKey}/${nivelKey}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    const habilitado = Boolean(data?.data?.reintentoHabilitado);
    if (!habilitado) return false;

    const consumo = await fetch(
      `${API_BASE_URL}/api/niveles/evaluacionFinal/reintento/consumir`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey, nivelKey }),
      }
    );
    if (!consumo.ok) return false;

    const prefijo = PREFIJOS[nivelIdLocal] || "visual";
    const nivelClave = nivelEnClaveLocal(islaKey, nivelIdLocal);
    const doneKey = `u:${usuarioKey}:isla${islaKey}_nivel${nivelClave}_${prefijo}_done`;
    const scoreKey = `u:${usuarioKey}:isla${islaKey}_nivel${nivelClave}_${prefijo}_score`;
    await AsyncStorage.multiRemove([doneKey, scoreKey]);

    return true;
  } catch (e) {
    console.log("intentarConsumirReintento: error", e);
    return false;
  }
}

/**
 * Trae del servidor los niveles que el usuario ya completo en esta isla y
 * deja sus marcas locales (done/score), para que el mapa los muestre aunque
 * se haya cambiado de dispositivo, reinstalado la app o borrado el
 * almacenamiento. Solo agrega: nunca borra marcas locales, asi un nivel recien
 * terminado no se pierde si el servidor aun no lo refleja. Sin conexion no
 * hace nada y el mapa sigue con lo que haya en el dispositivo.
 */
export async function sincronizarProgresoIsla(usuarioKey: number, islaKey: number): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/islas/${usuarioKey}/resultados`);
    if (!res.ok) return;
    const resultados = (await res.json())?.resultados ?? {};

    const marcas: [string, string][] = [];
    for (let nivelIdLocal = 1; nivelIdLocal <= 5; nivelIdLocal++) {
      const nivelKey = nivelKeyReal(islaKey, nivelIdLocal);
      const r = resultados[`nivel_${nivelKey}`];
      if (!r) continue;
      const base = `u:${usuarioKey}:isla${islaKey}_nivel${nivelEnClaveLocal(islaKey, nivelIdLocal)}_${PREFIJOS[nivelIdLocal]}`;
      marcas.push([`${base}_done`, "true"], [`${base}_score`, String(r.puntaje ?? 0)]);
    }
    if (marcas.length) await AsyncStorage.multiSet(marcas);
  } catch (e) {
    console.log("sincronizarProgresoIsla: error", e);
  }
}
