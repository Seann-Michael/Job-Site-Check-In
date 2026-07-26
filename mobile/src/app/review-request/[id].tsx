import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Segmented } from '@/components/ui/basics';
import { DetailHeader, Screen, Section } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useData } from '@/hooks/use-data';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchClients } from '@/lib/clients';
import { fetchJob } from '@/lib/data';
import { notify } from '@/lib/format';
import { sendReviewRequest } from '@/lib/review-requests';
import { useAuth } from '@/providers/auth-provider';

const CHANNELS = [
  { value: 'sms', label: 'Text message' },
  { value: 'email', label: 'Email' },
];

export default function ReviewRequestScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, initializing } = useAuth();
  const { business } = useWorkspace();
  const { data: job } = useData(() => fetchJob(id ?? ''));
  const { data: clients } = useData(fetchClients);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState('sms');
  const [seeded, setSeeded] = useState(false);
  const [sending, setSending] = useState(false);

  // Prefill from the job's client record — wait for BOTH queries, or the
  // clients list arriving late means the phone never prefills.
  useEffect(() => {
    if (job && clients && !seeded) {
      setSeeded(true);
      setName(job.client_name === 'Unknown client' ? '' : job.client_name);
      const client = clients.find((entry) => entry.name === job.client_name);
      if (client) setContact(client.phone || client.email || '');
    }
  }, [job, clients, seeded]);

  if (!initializing && !user) {
    return <Redirect href="/login" />;
  }

  const fieldStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];

  const previewMessage = `Hi ${name.split(' ')[0] || 'there'}! Thanks for choosing ${
    business?.name ?? 'us'
  } for your ${job?.title.toLowerCase() ?? 'project'}. Would you mind sharing a quick review? It takes 30 seconds and helps a ton: [review link]`;

  const handleSend = async () => {
    if (!job || sending || !contact.trim()) return;
    setSending(true);
    const result = await sendReviewRequest(job, {
      customerName: name,
      phone: contact,
      channel: channel as 'sms' | 'email',
    });
    setSending(false);
    if (result.error) {
      notify('Could not send', result.error);
      return;
    }
    notify(
      'Review request queued',
      'It appears in the Reviews tab; delivery goes out through your review pipeline.',
    );
    router.back();
  };

  return (
    <Screen>
      <DetailHeader title="Request review" />

      {job ? (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Ionicons name="star" size={18} color={colors.star} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.text }}>
                {job.title}
              </Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                Happy customers right after a finished job leave the best reviews.
              </Text>
            </View>
          </Card>

          <Section title="Customer">
            <Card style={{ gap: Spacing.md }}>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
                <TextInput value={name} onChangeText={setName} style={fieldStyle} />
              </View>
              <View style={{ gap: 5 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {channel === 'sms' ? 'Phone number *' : 'Email address *'}
                </Text>
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  keyboardType={channel === 'sms' ? 'phone-pad' : 'email-address'}
                  autoCapitalize="none"
                  placeholder={channel === 'sms' ? '(555) 555-0123' : 'customer@email.com'}
                  placeholderTextColor={colors.textMuted}
                  style={fieldStyle}
                />
              </View>
              <Segmented options={CHANNELS} value={channel} onChange={setChannel} />
            </Card>
          </Section>

          <Section title="Message preview">
            <Card>
              <Text style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 }}>
                {previewMessage}
              </Text>
            </Card>
          </Section>

          <Button
            label="Send review request"
            icon="paper-plane-outline"
            loading={sending}
            disabled={!contact.trim()}
            onPress={() => void handleSend()}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            Delivery uses the same ReviewGate flow as the web dashboard.
          </Text>
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Job not found.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: 15,
  },
});
