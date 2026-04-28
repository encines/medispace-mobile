import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

export default function LegalScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(dashboard)/profile')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal y Privacidad</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'privacy' && styles.activeTab]} 
          onPress={() => setActiveTab('privacy')}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.activeTabText]}>Privacidad</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'terms' && styles.activeTab]} 
          onPress={() => setActiveTab('terms')}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.activeTabText]}>Términos</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'privacy' ? (
          <View style={styles.legalContent}>
            <Text style={styles.legalTitle}>Aviso de Privacidad</Text>
            <Text style={styles.legalDate}>Última actualización: 30 de Marzo, 2026</Text>
            
            <Text style={styles.legalBody}>
              En MediSpace, nos tomamos muy en serio la seguridad de tu información. Este aviso describe cómo recopilamos, usamos y protegemos tus datos personales y médicos.{"\n\n"}
              1. RECOLECCIÓN DE DATOS: Recopilamos información básica como nombre, correo, teléfono y datos clínicos (alergias, tipo de sangre) para facilitar tu atención médica.{"\n\n"}
              2. USO DE LA INFORMACIÓN: Tus datos solo se utilizan para gestionar tus citas, recordatorios y comunicación con los doctores seleccionados por ti. No vendemos tus datos a terceros.{"\n\n"}
              3. SEGURIDAD: Implementamos medidas técnicas y organizativas para proteger tus datos contra acceso no autorizado, pérdida o alteración.{"\n\n"}
              4. TUS DERECHOS: Tienes derecho a acceder, rectificar o cancelar el tratamiento de tus datos personales en cualquier momento desde esta aplicación o contactando a nuestro centro de privacidad.
            </Text>
          </View>
        ) : (
          <View style={styles.legalContent}>
            <Text style={styles.legalTitle}>Términos y Condiciones</Text>
            <Text style={styles.legalDate}>Última actualización: 30 de Marzo, 2026</Text>
            
            <Text style={styles.legalBody}>
              Bienvenido a MediSpace. Al usar nuestra aplicación, aceptas cumplir con los siguientes términos:{"\n\n"}
              1. NO EMERGENCIAS: Esta aplicación NO debe usarse para emergencias médicas críticas. En caso de riesgo vital, llama de inmediato a los servicios de urgencias de tu localidad.{"\n\n"}
              2. USO DE LA PLATAFORMA: MediSpace es un facilitador de citas. No somos responsables de la calidad del servicio médico prestado por los especialistas independientes registrados en la plataforma.{"\n\n"}
              3. CANCELACIONES: Cada doctor puede tener sus propias políticas de cancelación. Te comprometes a respetar los horarios agendados.{"\n\n"}
              4. RESPONSABILIDAD: El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 MediSpace Global. Todos los derechos reservados.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary },
  tabs: { 
    flexDirection: 'row', backgroundColor: Colors.surface, 
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { 
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: Colors.secondary },
  tabText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted },
  activeTabText: { color: Colors.secondary },
  content: { padding: Spacing.lg },
  legalContent: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  legalTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.primary, marginBottom: 8 },
  legalDate: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.lg, fontWeight: '600' },
  legalBody: { fontSize: FontSizes.sm, color: Colors.text, lineHeight: 24, textAlign: 'justify' },
  footer: { marginTop: Spacing.xxl, paddingBottom: Spacing.xl, alignItems: 'center' },
  footerText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
});
