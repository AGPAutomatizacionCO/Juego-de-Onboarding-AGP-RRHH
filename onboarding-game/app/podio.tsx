import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

const API_BASE = `${API_BASE_URL}/api`;

type Player = {
  usuarioKey: number;
  nombre: string;
  puntaje: number | null;
};

export default function PodioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const nivelKey = Number(params.nivelKey);
  const islaKey = Number(params.islaKey);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPodio();
  }, [nivelKey]);

  const loadPodio = async () => {
    try {
      setLoading(true);

      if (!nivelKey) {
        Alert.alert("Error", "No se especificó el nivel");
        router.back();
        return;
      }

      // 1. Obtener USUARIO_KEY desde AsyncStorage
      const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
      const usuarioKey = Number(ukStr);

      if (!ukStr || !Number.isFinite(usuarioKey) || usuarioKey <= 0) {
        Alert.alert("Sesión inválida", "Vuelve a iniciar sesión.");
        router.replace("/registration");
        return;
      }

      // 2. Obtener USUARIO_NUMERO_ONBOARDING del usuario actual
      const userRes = await fetch(`${API_BASE}/usuarios/${usuarioKey}`);
      const userData = await userRes.json();

      const numeroOnboarding = Number(userData?.data?.USUARIO_NUMERO_ONBOARDING);
      if (!numeroOnboarding || !Number.isFinite(numeroOnboarding)) {
        Alert.alert("Error", "No se pudo obtener el grupo de onboarding.");
        setPlayers([]);
        return;
      }

      // 3. Cargar podio con la nueva ruta /podio/:numeroOnboarding?nivelKey=...
      const podioRes = await fetch(
        `${API_BASE}/niveles/evaluacionFinal/podio?nivelKey=${nivelKey}&numeroOnboarding=${numeroOnboarding}`

      );
      const podioData = await podioRes.json();

      if (podioData?.success && Array.isArray(podioData?.data)) {
        setPlayers(
          podioData.data.map((row: any) => ({
            usuarioKey: row.usuarioKey,
            nombre: row.nombre ?? "Sin nombre",
            puntaje: row.puntaje != null ? Number(row.puntaje) : null,
          }))
        );
      } else {
        setPlayers([]);
      }
    } catch (e: any) {
      console.error("Error cargando podio:", e);
      Alert.alert("Error", "No se pudo cargar el podio");
    } finally {
      setLoading(false);
    }
  };

  // Respondentes arriba ordenados por puntaje, no-respondentes abajo
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.puntaje == null && b.puntaje == null) return 0;
    if (a.puntaje == null) return 1;
    if (b.puntaje == null) return -1;
    return b.puntaje - a.puntaje;
  });

  // Top 3 = solo quienes tienen puntaje
  const respondentes = sortedPlayers.filter((p) => p.puntaje != null);
  const top3 = respondentes.slice(0, 3);

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Cargando podio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Podio - Evaluación Final</Text>
        <Text style={styles.subtitle}>
          {islaKey === 1
            ? "Introducción"
            : islaKey === 2
            ? "HSE"
            : islaKey === 3
            ? "Procesos"
            : `Isla ${islaKey}`}
        </Text>
      </View>

      {/* TOP 3 — solo respondentes */}
      {top3.length > 0 && (
        <View style={styles.top3Container}>
          {top3[1] && (
            <View style={[styles.medalBox, { marginTop: 20 }]}>
              <Text style={[styles.medalEmoji, { fontSize: 40 }]}>🥈</Text>
              <Text style={styles.medalName} numberOfLines={1}>
                {top3[1].nombre}
              </Text>
              <Text style={styles.medalScore}>{top3[1].puntaje}%</Text>
            </View>
          )}

          {top3[0] && (
            <View style={[styles.medalBox, { marginTop: 0 }]}>
              <Text style={[styles.medalEmoji, { fontSize: 50 }]}>🥇</Text>
              <Text
                style={[styles.medalName, { fontSize: 18 }]}
                numberOfLines={1}
              >
                {top3[0].nombre}
              </Text>
              <Text style={[styles.medalScore, { fontSize: 24 }]}>
                {top3[0].puntaje}%
              </Text>
            </View>
          )}

          {top3[2] && (
            <View style={[styles.medalBox, { marginTop: 20 }]}>
              <Text style={[styles.medalEmoji, { fontSize: 40 }]}>🥉</Text>
              <Text style={styles.medalName} numberOfLines={1}>
                {top3[2].nombre}
              </Text>
              <Text style={styles.medalScore}>{top3[2].puntaje}%</Text>
            </View>
          )}
        </View>
      )}

      {/* LISTA COMPLETA — todos los usuarios, incluso los que no respondieron */}
      <Text style={styles.listTitle}>Todos los participantes</Text>
      <ScrollView style={styles.list}>
        {sortedPlayers.map((p, idx) => (
          <View key={String(p.usuarioKey)} style={styles.playerRow}>
            <Text style={styles.playerRank}>{getMedal(idx)}</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {p.nombre}
            </Text>
            {p.puntaje != null ? (
              <Text style={styles.playerScore}>{p.puntaje}%</Text>
            ) : (
              <Text style={styles.playerNoResponse}>Aún no responde</Text>
            )}
          </View>
        ))}
        {sortedPlayers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aún no hay resultados</Text>
            <Text style={styles.emptySubtext}>
              Sé el primero en completar la evaluación
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#a3ecf1",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    color: "#AAAAAA",
    marginTop: 5,
  },
  top3Container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  medalBox: {
    alignItems: "center",
    marginHorizontal: 10,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    minWidth: 100,
  },
  medalEmoji: {
    marginBottom: 5,
  },
  medalName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  medalScore: {
    color: "#a3ecf1",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 5,
  },
  listTitle: {
    color: "#AAAAAA",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  list: {
   maxHeight: 250,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    marginBottom: 8,
  },
  playerRank: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    width: 44,
  },
  playerName: {
    color: "#FFFFFF",
    fontSize: 16,
    flex: 1,
  },
  playerScore: {
    color: "#a3ecf1",
    fontSize: 16,
    fontWeight: "bold",
  },
  playerNoResponse: {
    color: "#6B7280",
    fontSize: 13,
    fontStyle: "italic",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  emptySubtext: {
    color: "#AAAAAA",
    fontSize: 14,
    marginTop: 5,
  },
  backBtn: {
    backgroundColor: "#a3ecf1",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 0,
  },
  backBtnText: {
    color: "#1a1a2e",
    fontSize: 16,
    fontWeight: "bold",
  },
});