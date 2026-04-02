import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../ui/Skeleton';
import { Spacing, BorderRadius } from '../../constants/theme';

export const StatsSkeleton = () => (
  <View style={styles.statsRow}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={styles.statCard}>
        <Skeleton width={40} height={40} borderRadius={12} style={{ marginBottom: 10 }} />
        <Skeleton width="60%" height={24} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={12} />
      </View>
    ))}
  </View>
);

export const StatsSkeletonWide = () => (
  <View style={styles.statsRow}>
    <View style={[styles.statCardWide, { padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <View style={{ gap: 8 }}>
        <Skeleton width={40} height={36} />
        <Skeleton width={100} height={14} />
      </View>
      <Skeleton width={50} height={50} borderRadius={25} />
    </View>
  </View>
);

export const AppointmentSkeleton = () => (
  <View style={{ gap: 12 }}>
    {[1, 2].map((i) => (
      <View key={i} style={styles.ticketCard}>
        <View style={styles.ticketLeft}>
          <Skeleton width={30} height={24} />
          <Skeleton width={40} height={12} />
        </View>
        <View style={styles.ticketRight}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Skeleton width={60} height={16} />
            <Skeleton width={80} height={16} borderRadius={6} />
          </View>
          <Skeleton width="80%" height={18} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={14} />
        </View>
      </View>
    ))}
  </View>
);

export const FeedbackSkeleton = () => (
  <View style={{ marginBottom: 24 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
      <Skeleton width={100} height={18} />
      <Skeleton width={50} height={20} borderRadius={10} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {[1, 2].map((i) => (
        <View key={i} style={styles.reviewCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
             <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Skeleton width={20} height={20} borderRadius={10} />
                <Skeleton width={60} height={12} />
             </View>
             <Skeleton width={40} height={10} />
          </View>
          <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
          <Skeleton width="70%" height={12} />
        </View>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: BorderRadius.xl, alignItems: 'center' },
  statCardWide: { flex: 1, backgroundColor: 'white', borderRadius: BorderRadius.xxl },
  ticketCard: { backgroundColor: 'white', borderRadius: BorderRadius.xl, flexDirection: 'row', overflow: 'hidden' },
  ticketLeft: { width: 70, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ticketRight: { flex: 1, padding: 16, gap: 4 },
  reviewCard: { width: 220, backgroundColor: 'white', padding: 12, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: '#eee' },
});
