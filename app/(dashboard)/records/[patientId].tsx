import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Spacing } from '../../../constants/theme';

type TabType = 'perfil' | 'historia' | 'evolucion';

export default function PatientRecordScreen() {
  const { patientId, appointmentId } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();
  const isDoctor = roles.includes('doctor');
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('evolucion');
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

  const [editedHistory, setEditedHistory] = useState({
    blood_type: '',
    allergies: '',
    family_history: '',
    pathological: '',
    non_pathological: '',
    obs_history: ''
  });

  const pickPhoto = async () => {
    if (!isDoctor) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requiere permiso para cambiar la foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUpdatingPhoto(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop();
      const filePath = `${patientId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, {
        contentType: `image/${fileExt === 'jpg' || fileExt === 'jpeg' ? 'jpeg' : fileExt}`,
        upsert: true
      });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', patientId);
      if (updateError) throw updateError;

      await refetchPatient();
      Alert.alert('Éxito', 'Foto actualizada correctamente');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo subir la imagen');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const { data: patient, isLoading: isLoadingPatient, refetch: refetchPatient } = useQuery({
    queryKey: ['patient-profile', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', patientId)
        .single();
      if (error) throw error;
      return data;
    },
  });


  // Form State for New Note
  const [newNote, setNewNote] = useState({
    reason: '',
    physical_exam: '',
    blood_pressure: '',
    heart_rate: '',
    respiratory_rate: '',
    temperature: '',
    weight: '',
    height: '',
    diagnosis: '',
    treatment: '',
    prescription: '',
  });

  // Auto-open modal if coming from an attended appointment
  useEffect(() => {
    if (appointmentId) {
      setIsNoteModalVisible(true);
      setActiveTab('evolucion');
    }
  }, [appointmentId]);

  // 2. Fetch Medical Records (Notes)
  const { data: records, isLoading: isLoadingRecords, refetch: refetchRecords } = useQuery({
    queryKey: ['patient-records', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      let targetAppointmentId = appointmentId;

      // If no appointmentId was passed as a param, try to find the last one between this doctor and patient
      if (!targetAppointmentId) {
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)
          .eq('doctor_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1);
        targetAppointmentId = appointments?.[0]?.id;
      }
      
      // We no longer throw an error here, allowing notes without a specific appointment
      
      const { error } = await supabase.from('medical_records').insert({
        patient_id: patientId as string,
        doctor_id: user?.id as string,
        appointment_id: targetAppointmentId || null, // Allow null
        reason: newNote.reason,
        physical_exam: newNote.physical_exam,
        blood_pressure: newNote.blood_pressure,
        heart_rate: newNote.heart_rate ? parseInt(newNote.heart_rate) : null,
        respiratory_rate: newNote.respiratory_rate ? parseInt(newNote.respiratory_rate) : null,
        temperature: newNote.temperature ? parseFloat(newNote.temperature) : null,
        weight: newNote.weight ? parseFloat(newNote.weight) : null,
        height: newNote.height ? parseFloat(newNote.height) : null,
        diagnosis: newNote.diagnosis,
        treatment: newNote.treatment,
        prescription: newNote.prescription,
      });

      if (error) throw error;

      // Automatically complete the appointment if one was linked
      if (targetAppointmentId) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ status: 'completed' as any })
          .eq('id', targetAppointmentId);
          
        if (updateError) {
          console.error("Error updating appointment status:", updateError);
          // We don't throw here to avoid failing the whole mutation if the record was already saved
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-records', patientId] });
      Alert.alert('Éxito', 'Nota guardada correctamente');
      setIsNoteModalVisible(false);
      setNewNote({
        reason: '', physical_exam: '', blood_pressure: '', heart_rate: '',
        respiratory_rate: '', temperature: '', weight: '', height: '',
        diagnosis: '', treatment: '', prescription: '',
      });
      // Clear appointmentId from URL to prevent accidental re-open
      router.setParams({ appointmentId: '' });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const updateHistoryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          blood_type: editedHistory.blood_type,
          allergies: editedHistory.allergies,
          medical_history: {
            family_history: editedHistory.family_history,
            pathological: editedHistory.pathological,
            non_pathological: editedHistory.non_pathological,
            obs_history: editedHistory.obs_history
          }
        })
        .eq('user_id', patientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-profile', patientId] });
      Alert.alert('Éxito', 'Historia clínica actualizada');
      setIsHistoryModalVisible(false);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleOpenHistory = () => {
    setEditedHistory({
      blood_type: patient?.blood_type || '',
      allergies: patient?.allergies || '',
      family_history: patient?.medical_history?.family_history || '',
      pathological: patient?.medical_history?.pathological || '',
      non_pathological: patient?.medical_history?.non_pathological || '',
      obs_history: patient?.medical_history?.obs_history || ''
    });
    setIsHistoryModalVisible(true);
  };

  const onRefresh = () => {
    refetchPatient();
    refetchRecords();
  };

  const handleDownloadPDF = async () => {
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e293b; }
              .header { border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
              .title { font-size: 24px; font-weight: bold; color: #0ea5e9; }
              .patient-info { margin-bottom: 30px; background: #f8fafc; padding: 20px; borderRadius: 10px; }
              .record-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
              .date { font-weight: bold; color: #64748b; font-size: 12px; }
              .label { font-weight: bold; color: #1e293b; margin-top: 10px; display: block; }
              .value { color: #475569; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Resumen de Expediente Clínico</div>
              <p>MediSpace - Salud Digital</p>
            </div>
            <div class="patient-info">
              <div class="label">Paciente:</div>
              <div class="value">${patient?.first_name} ${patient?.last_name}</div>
              <div class="label">ID:</div>
              <div class="value">${patient?.user_id}</div>
            </div>
            ${records?.map((r: any) => `
              <div class="record-card">
                <div class="date">${format(new Date(r.created_at), "dd/MM/yyyy")}</div>
                <div class="label">Motivo de Consulta:</div>
                <div class="value">${r.reason}</div>
                <div class="label">Diagnóstico:</div>
                <div class="value">${r.diagnosis}</div>
                <div class="label">Tratamiento:</div>
                <div class="value">${r.treatment}</div>
                ${r.prescription ? `<div class="label">Receta:</div><div class="value">${r.prescription}</div>` : ''}
              </div>
            `).join('')}
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el PDF');
    }
  };

  const isOwner = user?.id === patientId;

  if (!isDoctor && !isOwner && !isLoadingPatient) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="lock-closed" size={64} color={Colors.textMuted} style={{ marginBottom: 20 }} />
        <Text style={styles.emptyText}>Acceso restringido. Por motivos de privacidad clínica, los administradores no tienen acceso a los expedientes detallados.</Text>
        <TouchableOpacity onPress={() => router.replace('/(dashboard)/home')} style={styles.viewBtnLarge}>
          <Text style={styles.viewBtnLargeText}>Volver al Inicio</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoadingPatient) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  const age = patient?.date_of_birth ? differenceInYears(new Date(), new Date(patient.date_of_birth)) : 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Profile */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          <TouchableOpacity 
            style={styles.avatarMini} 
            onPress={pickPhoto} 
            disabled={updatingPhoto || !isDoctor}
            activeOpacity={0.7}
          >
            {updatingPhoto ? (
              <ActivityIndicator size="small" color={Colors.secondary} />
            ) : patient?.avatar_url ? (
              <Image 
                key={patient.avatar_url}
                source={{ uri: `${patient.avatar_url}${patient.avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}` }} 
                style={styles.avatarImg} 
              />
            ) : (
              <Text style={styles.avatarInitial}>{patient?.first_name ? patient.first_name[0] : 'U'}</Text>
            )}
            {isDoctor && !updatingPhoto && (
              <View style={styles.editPhotoBadge}>
                <Ionicons name="camera" size={10} color="white" />
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.headerName}>{patient?.first_name} {patient?.last_name}</Text>
            <Text style={styles.headerSub}>ID: {patient?.id.slice(0, 8)} • {age} años • {patient?.gender === 'male' ? 'H' : 'M'}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['perfil', 'historia', 'evolucion'] as TabType[])
          .filter(tab => isDoctor || tab === 'evolucion')
          .map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'perfil' ? 'Perfil' : tab === 'historia' ? 'Historia' : 'Evolución'}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      <ScrollView 
        style={styles.content} 
        refreshControl={<RefreshControl refreshing={isLoadingRecords} onRefresh={onRefresh} />}
      >
        {activeTab === 'perfil' && (
          <View style={styles.tabContent}>
            <Section title="Ficha de Identificación">
              <InfoRow label="Nombre Completo" value={`${patient?.first_name} ${patient?.last_name}`} />
              <InfoRow label="CURP" value={patient?.curp || 'No registrado'} highlight={!patient?.curp} />
              <InfoRow label="Fecha de Nacimiento" value={patient?.date_of_birth || 'No registrada'} />
              <InfoRow label="Sexo" value={patient?.gender === 'male' ? 'Masculino' : 'Femenino'} />
              <InfoRow label="Ocupación" value={patient?.occupation || 'No registrada'} />
              <InfoRow label="Estado Civil" value={patient?.marital_status || 'No registrado'} />
              <InfoRow label="Religión" value={patient?.religion || 'No registrada'} />
              <InfoRow label="Domicilio" value={patient?.address || 'No registrado'} />
              <InfoRow label="Teléfono" value={patient?.phone || 'No registrado'} />
              <InfoRow label="Etnia / Grupo" value={patient?.ethnic_group || 'No registrado'} />
              <InfoRow label="Discapacidad" value={patient?.disability || 'Ninguna registrada'} />
              <InfoRow label="Contacto de Emergencia" value={patient?.emergency_contact_name || 'No registrado'} />
              <InfoRow label="Tel. Emergencia" value={patient?.emergency_contact_phone || 'No registrado'} />
            </Section>
            <Section title="Datos Clínicos Base">
              <InfoRow label="Tipo de Sangre" value={patient?.blood_type || 'No registrado'} />
              <InfoRow label="Alergias" value={patient?.allergies || 'Ninguna conocida'} highlight />
            </Section>
          </View>
        )}

        {activeTab === 'historia' && (
          <View style={styles.tabContent}>
            <Section title="Antecedentes Heredo-familiares">
              <Text style={styles.historyText}>
                {patient?.medical_history?.family_history || 'Sin antecedentes registrados.'}
              </Text>
            </Section>
            <Section title="Antecedentes Personales Patológicos">
              <Text style={styles.historyText}>
                {patient?.medical_history?.pathological || 'Sin antecedentes registrados.'}
              </Text>
              <Text style={styles.subLabel}>Alergias registradas:</Text>
              <Text style={[styles.historyText, { color: '#dc2626' }]}>{patient?.allergies || 'Ninguna'}</Text>
            </Section>
            <Section title="Antecedentes Personales No Patológicos">
              <Text style={styles.historyText}>
                {patient?.medical_history?.non_pathological || 'Sin antecedentes registrados.'}
              </Text>
            </Section>
            <Section title="Gineco-Obstétricos (Si aplica)">
              <Text style={styles.historyText}>
                {patient?.medical_history?.obs_history || 'N/A o Sin registrar.'}
              </Text>
            </Section>
            {isDoctor && (
              <TouchableOpacity style={styles.editHistoryBtn} onPress={handleOpenHistory}>
                <Ionicons name="create-outline" size={18} color="white" />
                <Text style={styles.editHistoryText}>Actualizar Historia Clínica</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === 'evolucion' && (
          <View style={styles.tabContent}>
            <View style={styles.evolucionActions}>
              {isDoctor && (
                <TouchableOpacity style={styles.addNoteBtn} onPress={() => setIsNoteModalVisible(true)}>
                  <Ionicons name="add-circle" size={20} color="white" />
                  <Text style={styles.addNoteText}>Nueva Nota de Evolución</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPDF}>
                <Ionicons name="download-outline" size={20} color="white" />
                <Text style={styles.downloadBtnText}>Descargar Resumen PDF</Text>
              </TouchableOpacity>
            </View>

            {records?.map((record: any) => (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>{format(new Date(record.created_at), "dd 'de' MMMM, yyyy", { locale: es })}</Text>
                  <View style={styles.badge}><Text style={styles.badgeText}>Consulta</Text></View>
                </View>
                
                <Text style={styles.recordReasonLabel}>Padecimiento Actual / Motivo:</Text>
                <Text style={styles.recordReason}>{record.reason}</Text>

                <View style={styles.vitalsGrid}>
                  <VitalItem icon="thermometer" label="Temp" value={`${record.temperature}°C`} />
                  <VitalItem icon="speedometer" label="TA" value={record.blood_pressure} />
                  <VitalItem icon="heart" label="FC" value={record.heart_rate} />
                  <VitalItem icon="fitness" label="Peso" value={`${record.weight}kg`} />
                </View>

                <View style={styles.separator} />
                
                <Text style={styles.recordSectionTitle}>Diagnóstico:</Text>
                <Text style={styles.recordContent}>{record.diagnosis}</Text>

                <Text style={styles.recordSectionTitle}>Tratamiento:</Text>
                <Text style={styles.recordContent}>{record.treatment}</Text>
              </View>
            ))}
            
            {records?.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No hay notas de evolución previas</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* New Note Modal */}
      <Modal visible={isNoteModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nota de Evolución (NOM-004)</Text>
                <TouchableOpacity onPress={() => setIsNoteModalVisible(false)}>
                  <Ionicons name="close" size={24} color={'#1e293b'} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalForm} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
              <Text style={styles.formLabel}>Padecimiento Actual (Interrogatorio)</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                multiline 
                numberOfLines={3} 
                placeholder="Descripción de síntomas..."
                value={newNote.reason}
                onChangeText={(t) => setNewNote({...newNote, reason: t})}
              />

              <Text style={styles.formLabel}>Signos Vitales</Text>
              <View style={styles.formRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Presión (ej. 120/80)" value={newNote.blood_pressure} onChangeText={(t) => setNewNote({...newNote, blood_pressure: t})} />
                <TextInput style={[styles.input, { flex: 1, marginLeft: 8 }]} placeholder="Temp (°C)" keyboardType="numeric" value={newNote.temperature} onChangeText={(t) => setNewNote({...newNote, temperature: t})} />
              </View>
              <View style={styles.formRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Frec. Cardíaca" keyboardType="numeric" value={newNote.heart_rate} onChangeText={(t) => setNewNote({...newNote, heart_rate: t})} />
                <TextInput style={[styles.input, { flex: 1, marginLeft: 8 }]} placeholder="Peso (kg)" keyboardType="numeric" value={newNote.weight} onChangeText={(t) => setNewNote({...newNote, weight: t})} />
              </View>

              <Text style={styles.formLabel}>Exploración Física</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                multiline 
                placeholder="Hallazgos físicos..."
                value={newNote.physical_exam}
                onChangeText={(t) => setNewNote({...newNote, physical_exam: t})}
              />

              <Text style={styles.formLabel}>Diagnóstico</Text>
              <TextInput style={styles.input} placeholder="Impresión diagnóstica" value={newNote.diagnosis} onChangeText={(t) => setNewNote({...newNote, diagnosis: t})} />

              <Text style={styles.formLabel}>Tratamiento / Plan</Text>
              <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Indicaciones médicas..." value={newNote.treatment} onChangeText={(t) => setNewNote({...newNote, treatment: t})} />

              <TouchableOpacity 
                style={[styles.saveBtn, createNoteMutation.isPending && { opacity: 0.7 }]}
                onPress={() => createNoteMutation.mutate()}
                disabled={createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Guardar Nota</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit History Modal */}
      <Modal visible={isHistoryModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Actualizar Historia Clínica</Text>
                <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                  <Ionicons name="close" size={24} color={'#1e293b'} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalForm} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
              <Text style={styles.formLabel}>Datos Base</Text>
              <View style={styles.formRow}>
                <TextInput 
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="Tipo de Sangre" 
                  value={editedHistory.blood_type} 
                  onChangeText={(t) => setEditedHistory({...editedHistory, blood_type: t})} 
                />
                <TextInput 
                  style={[styles.input, { flex: 2, marginLeft: 8 }]} 
                  placeholder="Alergias" 
                  value={editedHistory.allergies} 
                  onChangeText={(t) => setEditedHistory({...editedHistory, allergies: t})} 
                />
              </View>

              <Text style={styles.formLabel}>Antecedentes Heredo-familiares</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                multiline 
                placeholder="Diabetes, hipertensión, cáncer..."
                value={editedHistory.family_history}
                onChangeText={(t) => setEditedHistory({...editedHistory, family_history: t})}
              />

              <Text style={styles.formLabel}>Antecedentes Personales Patológicos</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                multiline 
                placeholder="Cirugías, fracturas, enfermedades crónicas..."
                value={editedHistory.pathological}
                onChangeText={(t) => setEditedHistory({...editedHistory, pathological: t})}
              />

              <Text style={styles.formLabel}>Antecedentes Personales No Patológicos</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                multiline 
                placeholder="Tabaquismo, alcohol, actividad física..."
                value={editedHistory.non_pathological}
                onChangeText={(t) => setEditedHistory({...editedHistory, non_pathological: t})}
              />

              <Text style={styles.formLabel}>Antecedentes Gineco-Obstétricos (Si aplica)</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                multiline 
                placeholder="Menarquia, Gesta, Para, Cesáreas, Abortos..."
                value={editedHistory.obs_history}
                onChangeText={(t) => setEditedHistory({...editedHistory, obs_history: t})}
              />

              <TouchableOpacity 
                style={[styles.saveBtn, updateHistoryMutation.isPending && { opacity: 0.7 }]}
                onPress={() => updateHistoryMutation.mutate()}
                disabled={updateHistoryMutation.isPending}
              >
                {updateHistoryMutation.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Actualizar Historia</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: '#dc2626', fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

function VitalItem({ icon, label, value }: { icon: any, label: string, value: string | number | null }) {
  return (
    <View style={styles.vitalItem}>
      <Ionicons name={icon} size={14} color={'#0ea5e9'} />
      <View>
        <Text style={styles.vitalLabel}>{label}</Text>
        <Text style={styles.vitalValue}>{value || '--'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', alignItems: 'center', padding: 16, 
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backBtn: { marginRight: 16 },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarMini: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#dbeafe' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  editPhotoBadge: { 
    position: 'absolute', bottom: -2, right: -2, backgroundColor: Colors.secondary, 
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'white',
  },
  avatarInitial: { color: '#0ea5e9', fontSize: 18, fontWeight: '800' },
  headerName: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#0ea5e9' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  activeTabText: { color: '#0ea5e9' },
  content: { flex: 1 },
  tabContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  sectionContent: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#1e293b', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  historyText: { fontSize: 14, color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  evolucionActions: { flexDirection: 'column', gap: 10, marginBottom: 20 },
  downloadBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6366f1', padding: 14, borderRadius: 12,
  },
  downloadBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  addNoteBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0ea5e9', padding: 14, borderRadius: 12,
  },
  addNoteText: { color: 'white', fontWeight: '800', fontSize: 14 },
  recordCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recordDate: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  badge: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#0ea5e9', textTransform: 'uppercase' },
  recordReasonLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 2 },
  recordReason: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 16 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  vitalItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', padding: 8, borderRadius: 10, minWidth: '45%' },
  vitalLabel: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  vitalValue: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  separator: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  recordSectionTitle: { fontSize: 12, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  recordContent: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 12 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#64748b', marginTop: 10, fontSize: 14 },

  subLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginLeft: 16, marginTop: -8, marginBottom: 8, textTransform: 'uppercase' },
  editHistoryBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6366f1', padding: 14, borderRadius: 12, marginTop: 10,
  },
  editHistoryText: { color: 'white', fontWeight: '800', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  keyboardAvoidingView: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: Platform.OS === 'ios' ? '85%' : '90%', width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  modalForm: { maxHeight: '100%' },
  formLabel: { fontSize: 14, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 14, fontSize: 15, color: '#1e293b' },
  textArea: { height: 100, textAlignVertical: 'top' },
  formRow: { flexDirection: 'row', marginBottom: 8 },
  saveBtn: { backgroundColor: '#0ea5e9', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 24, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  viewBtnLarge: { backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 20, width: '60%', alignItems: 'center' },
  viewBtnLargeText: { color: 'white', fontWeight: '800', fontSize: 14 },
});
