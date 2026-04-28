import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const faqs = [
  {
    question: '¿Qué es MediSpace?',
    answer: 'MediSpace es una plataforma integral de gestión hospitalaria diseñada para agilizar la interacción entre pacientes y especialistas médicos, ofreciendo una experiencia digital fluida para agendar y gestionar citas.'
  },
  {
    question: '¿Cómo agendar una cita?',
    answer: 'Ve a la pestaña "Doctores", selecciona el especialista de tu preferencia, elige una fecha y horario disponible, ¡y listo! Recibirás una confirmación inmediata.'
  },
  {
    question: '¿Puedo cancelar una cita?',
    answer: 'Sí, desde la pestaña "Mis Citas" puedes seleccionar una cita programada y elegir la opción de cancelar. Te recomendamos hacerlo con al menos 24 horas de anticipación.'
  },
  {
    question: '¿Es segura mi información?',
    answer: 'Totalmente. En MediSpace utilizamos los más altos estándares de encriptación y cumplimos con las normativas locales de protección de datos personales y salud.'
  },
  {
    question: '¿Qué hago si mi doctor no llega?',
    answer: 'Si un especialista no se presenta, puedes reportarlo desde el detalle de la cita o contactando a nuestro centro de atención a través de los números de emergencia en tu perfil.'
  },
  {
    question: '¿Tengo que pagar por la app?',
    answer: 'La descarga y uso de la aplicación MediSpace para pacientes es gratuita. Únicamente se realizan cobros por las consultas médicas recibidas de acuerdo a las tarifas de cada especialista.'
  }
];

function FAQItem({ item }: { item: typeof faqs[0] }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity 
      style={[styles.faqCard, expanded && styles.faqCardExpanded]} 
      onPress={toggle} 
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.question, expanded && styles.questionActive]}>{item.question}</Text>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={expanded ? Colors.secondary : Colors.textMuted} 
        />
      </View>
      {expanded && (
        <View style={styles.faqContent}>
          <Text style={styles.answer}>{item.answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function FAQScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(dashboard)/profile')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preguntas Frecuentes</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introBox}>
          <Ionicons name="help-buoy-outline" size={48} color={Colors.secondary} />
          <Text style={styles.introTitle}>¿En qué podemos ayudarte?</Text>
          <Text style={styles.introText}>
            Encuentra respuestas rápidas a las dudas más comunes sobre el uso de la plataforma MediSpace.
          </Text>
        </View>

        <View style={styles.listContainer}>
          {faqs.map((faq, index) => (
            <FAQItem key={index} item={faq} />
          ))}
        </View>

        <View style={styles.supportBox}>
          <Text style={styles.supportTitle}>¿Aún tienes dudas?</Text>
          <Text style={styles.supportText}>
            Nuestro equipo de soporte técnico está disponible 24/7 para ayudarte.
          </Text>
          <TouchableOpacity style={styles.contactBtn}>
            <Text style={styles.contactBtnText}>Contactar Soporte</Text>
          </TouchableOpacity>
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
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary },
  content: { padding: Spacing.lg },
  introBox: { alignItems: 'center', paddingVertical: Spacing.xl },
  introTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.primary, marginTop: Spacing.md },
  introText: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 18 },
  listContainer: { marginTop: Spacing.lg },
  faqCard: { 
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, 
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  faqCardExpanded: { borderColor: Colors.secondary, shadowColor: Colors.secondary, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, flex: 1, paddingRight: Spacing.sm },
  questionActive: { color: Colors.secondary },
  faqContent: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  answer: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 22 },
  supportBox: { 
    marginTop: Spacing.xxl, backgroundColor: Colors.primary, 
    padding: Spacing.xl, borderRadius: BorderRadius.xl, alignItems: 'center',
  },
  supportTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: 'white' },
  supportText: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  contactBtn: { 
    backgroundColor: Colors.secondary, paddingHorizontal: Spacing.xl, 
    paddingVertical: 12, borderRadius: BorderRadius.full, marginTop: Spacing.lg,
  },
  contactBtnText: { color: 'white', fontWeight: '700' },
});
