import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useState } from "react";
import {
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

// 🔗 API (Node + Express + SQL Server)


const API_URL = API_BASE_URL;

export default function RegistrationScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<
    "menu" | "chooseRole" | "loginPlayer" | "register"
  >("menu");

  // Registro
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [nOnboarding, setNOnboarding] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Login
  const [loginCedula, setLoginCedula] = useState("");

  // Alertas
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertColor, setAlertColor] = useState("#4C92E4");
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  }, []);

  const showCustomAlert = (message: string, color = "#4C92E4") => {
    setAlertMessage(message);
    setAlertColor(color);
    setAlertVisible(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setAlertVisible(false));
    }, 2500);
  };

  const safeJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  // ✅ saca usuarioKey aunque el backend lo mande con nombres distintos
  const extractUsuarioKey = (data: any): number | null => {
    const candidates = [
      data?.usuarioKey,
      data?.USUARIO_KEY,
      data?.data?.usuarioKey,
      data?.data?.USUARIO_KEY,
      data?.usuario?.usuarioKey,
      data?.usuario?.USUARIO_KEY,
      data?.data?.usuario?.USUARIO_KEY,
      data?.data?.usuario?.usuarioKey,
    ];

    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  // ✅ Limpia progreso/estado local que pueda quedar pegado entre usuarios
  const clearLocalProgressCache = async () => {
    const keysToRemove = [
      "USUARIO_PROGRESO_ISLA",
      "USUARIO_PROGRESO_NIVEL",

      // ⚠️ por si quedaron caches viejos globales:
      "progresoIsla",
      "progresoNivel",
      "progress",

      // ⚠️ legacy de sesión:
      "usuarioKey",
    ];
    await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k)));
  };

  /**
   * ✅ NUEVO (CRÍTICO): borra progreso legacy global que se “pega” entre usuarios
   * Esto es lo que causaba que un usuario nuevo viera el progreso del anterior.
   */
  const clearLegacyGameProgress = async () => {
    await AsyncStorage.multiRemove([
      // legacy genéricas
      "nivelVisualCompletado",

      // visual/lectura legacy global (sin usuario en la key)
      "isla1_nivel1_visual_done",
      "isla1_nivel1_visual_score",
      "isla1_nivel1_visual_aprobado",
      "isla1_nivel1_visual_mismatches",
      "isla1_nivel2_lectura_unlocked",

      "isla1_nivel2_lectura_done",
      "isla1_nivel2_lectura_score",
      "isla1_nivel2_lectura_aprobado",
      "isla1_nivel3_recordemos_unlocked",

      // por si guardaste cosas sueltas en otros momentos
      "visualDone",
      "lecturaDone",
    ]);

    console.log("🧹 Legacy game progress eliminado");
  };

  // ✅ SESIÓN FINAL: SOLO USUARIO_KEY (sin duplicados legacy)
  const persistSession = async (data: any, ced: string, nom?: string) => {
    const usuarioKey = extractUsuarioKey(data);

    if (!usuarioKey) {
      throw new Error("El API no devolvió usuarioKey");
    }

    // 🔥 IMPORTANTÍSIMO: elimina llaves viejas antes de setear (evita “usuario anterior pegado”)
    await AsyncStorage.removeItem("USUARIO_KEY");
    await AsyncStorage.removeItem("usuarioKey"); // legacy fuera
    await clearLocalProgressCache();
    await clearLegacyGameProgress();

    // ✅ ÚNICA llave oficial
    await AsyncStorage.setItem("USUARIO_KEY", String(usuarioKey));

    // datos extra
    await AsyncStorage.setItem("USUARIO_CEDULA", String(ced));
    if (nom) await AsyncStorage.setItem("USUARIO_NOMBRE", String(nom));

    // Debug útil
    const kMain = await AsyncStorage.getItem("USUARIO_KEY");
    console.log("✅ SESSION GUARDADA:", { USUARIO_KEY: kMain });
  };

  // 🟢 REGISTRO → SQL
  const handleRegister = async () => {
    if (!nombre || !cedula || !nOnboarding) {
      showCustomAlert("⚠️ Por favor completa todos los campos", "#FAD092");
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`${API_URL}/api/usuarios/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          cedula: cedula.trim(),
          nOnboarding: nOnboarding.trim(),
        }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo registrar");
      }

      // ✅ guarda sesión + limpia progreso viejo
      await persistSession(data, cedula.trim(), nombre.trim());

      showCustomAlert("✅ Registro exitoso", "#77B479");
      setTimeout(() => router.push("/mapa"), 800);
    } catch (error: any) {
      showCustomAlert(
        `❌ No se pudo guardar el registro: ${error?.message || error}`,
        "#E53935"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 🔵 LOGIN → SQL
  const handleLogin = async () => {
    if (!loginCedula) {
      showCustomAlert("⚠️ Ingresa tu cédula", "#FAD092");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/usuarios/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: loginCedula.trim() }),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Cédula no encontrada");
      }

      // ✅ guarda sesión + limpia progreso viejo
      await persistSession(
        data,
        loginCedula.trim(),
        data?.nombre || data?.data?.nombre
      );

      // progreso si lo mandan (solo informativo)
      const progresoIsla =
        data?.progresoIsla ??
        data?.data?.progresoIsla ??
        data?.PROGRESO_ISLA ??
        null;

      const progresoNivel =
        data?.progresoNivel ??
        data?.data?.progresoNivel ??
        data?.PROGRESO_NIVEL ??
        null;

      if (progresoIsla != null) {
        await AsyncStorage.setItem(
          "USUARIO_PROGRESO_ISLA",
          String(progresoIsla)
        );
      }
      if (progresoNivel != null) {
        await AsyncStorage.setItem(
          "USUARIO_PROGRESO_NIVEL",
          String(progresoNivel)
        );
      }

      showCustomAlert("✅ Bienvenido", "#77B479");
      setTimeout(() => router.push("/mapa"), 800);
    } catch (error: any) {
      showCustomAlert(
        `❌ ${error?.message || "Cédula no encontrada"}`,
        "#E53935"
      );
    }
  };

  return (
    <ImageBackground
      source={require("../assets/FONDOREG.png")}
      style={styles.background}
      resizeMode="cover"
    >
      {alertVisible && (
        <Animated.View
          style={[
            styles.alertBox,
            {
              backgroundColor: alertColor,
              opacity: fadeAnim,
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.alertText}>{alertMessage}</Text>
        </Animated.View>
      )}

      {mode === "menu" && (
        <View style={styles.overlay}>
          <View style={styles.menuBox}>
            <Text style={styles.titleText}>ONBOARDING GAME</Text>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setMode("register")}
            >
              <Text style={styles.menuButtonText}>Registrar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setMode("chooseRole")}
            >
              <Text style={styles.menuButtonText}>Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode === "chooseRole" && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => setMode("menu")}
          >
            <Text style={styles.backLinkText}>← Volver</Text>
          </TouchableOpacity>

          <View style={styles.menuBox}>
            <Text style={styles.loginTitle}>¿Cómo quieres ingresar?</Text>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setMode("loginPlayer")}
            >
              <Text style={styles.menuButtonText}>Jugador</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => router.push("/adminPanel")}
            >
              <Text style={styles.menuButtonText}>Administrador</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode === "loginPlayer" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => setMode("chooseRole")}
          >
            <Text style={styles.backLinkText}>← Volver</Text>
          </TouchableOpacity>

          <View style={styles.form}>
            <Text style={styles.loginTitleSmall}>Ingresa tu cédula</Text>

            <TextInput
              style={styles.input}
              placeholder="Cédula"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={loginCedula}
              onChangeText={setLoginCedula}
            />

            <TouchableOpacity style={styles.menuButton} onPress={handleLogin}>
              <Text style={styles.menuButtonText}>Ingresar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {mode === "register" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => setMode("menu")}
          >
            <Text style={styles.backLinkText}>← Volver</Text>
          </TouchableOpacity>

          <View style={styles.form}>
            <Text style={styles.label}>NOMBRE Y APELLIDO</Text>
            <TextInput
              style={styles.input}
              placeholder="Ingresa tu nombre y apellido"
              placeholderTextColor="#555"
              value={nombre}
              onChangeText={(text) =>
                setNombre(text.replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñ\s]/g, ""))
              }
            />

            <Text style={styles.label}>CÉDULA</Text>
            <TextInput
              style={styles.input}
              placeholder="Ingresa tu cédula"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={cedula}
              onChangeText={setCedula}
            />

            <Text style={styles.label}>N. ONBOARDING</Text>
            <TextInput
              style={styles.input}
              placeholder="Ingresa tu número"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={nOnboarding}
              onChangeText={setNOnboarding}
            />

            <TouchableOpacity
              style={[
                styles.menuButton,
                isSaving && { backgroundColor: "#ddd" },
              ]}
              onPress={handleRegister}
              disabled={isSaving}
            >
              <Text style={styles.menuButtonText}>
                {isSaving ? "Guardando..." : "Registrar"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  menuBox: {
    width: "60%",
    backgroundColor: "#8fc5cf",
    paddingHorizontal: 30,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: "center",
    gap: 16,
  },
  menuButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
  },
  menuButtonText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    color: "#000",
    fontSize: 20,
    textAlign: "center",
  },
  titleText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    color: "#ffffff",
    fontSize: 28,
    marginBottom: 10,
    textAlign: "center",
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 12,
    marginLeft: "10%",
  },
  backLinkText: {
    fontFamily: "PlusJakartaSans-Bold",
    color: "#ffffff",
    fontSize: 18,
  },
  loginTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    color: "#ffffff",
    marginBottom: 14,
  },
  loginTitleSmall: {
    fontFamily: "PlusJakartaSans-Bold",
    color: "#ffffff",
    fontSize: 20,
    marginBottom: 14,
  },
  form: {
    width: "60%",
    backgroundColor: "#8fc5cf",
    paddingHorizontal: 30,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: "#ffffff",
    alignSelf: "flex-start",
  },
  input: {
    fontFamily: "PlusJakartaSans-Medium",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    width: "100%",
    color: "#000",
  },
  alertBox: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 20,
    zIndex: 999,
  },
  alertText: {
    fontFamily: "PlusJakartaSans-Bold",
    color: "#fff",
    fontSize: 20,
  },
});
