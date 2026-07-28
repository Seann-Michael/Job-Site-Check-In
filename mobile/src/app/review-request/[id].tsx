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
import { REVIEW_DELIVERY_NOTE, reviewBaseUrl, sendReviewRequest } from '@/lib/review-requests';
import { useAuth } from '@/providers/auth-provider';

/**
 * QR is first and is the default because it is the only option on this screen
 * that actually reaches the customer: they are standing in front of you and
 * scan it. Text and email do NOT send from the phone — see
 * lib/review-requests.ts, nothing in this product delivers a review request —
 * so picking them only records a row for someone to send from the web dashboard.
 *
 * `qr` is a handover method, not a delivery channel: the row is still created
 * (the customer needs a link to scan) but nothing is sent, so no phone or
 * email is required. ReviewRequest.channel only has sms/email, so a QR request
 * is filed under the contact detail you did have — see handleSend.
 */
const CHANNELS = [
  { value: 'qr', label: 'QR code' },
  { value: 'sms', label: 'Text' },
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
  // QR by default: it is the one path that reaches the customer today.
  const [channel, setChannel] = useState('qr');
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

  const isQr = channel === 'qr';
  // A QR code is a printed link, so without a configured web app URL there is
  // nothing legitimate to encode. Blocked here as well as on the QR screen so
  // we never create a request that cannot be shown.
  const qrBlocked = isQr && !reviewBaseUrl();

  const previewMessage = `Hi ${name.split(' ')[0] || 'there'}! Thanks for choosing ${
    business?.name ?? 'us'
  } for your ${job?.title.toLowerCase() ?? 'project'}. Would you mind sharing a quick review? It takes 30 seconds and helps a ton: [review link]`;

  const handleSend = async () => {
    if (!job || sending || qrBlocked) return;
    if (!isQr && !contact.trim()) return;
    setSending(true);
    const result = await sendReviewRequest(job, {
      customerName: name,
      phone: contact,
      // The row still records how you reached them where you know it; a QR
      // handover with no contact detail is filed as sms, matching the web app.
      channel: channel === 'email' ? 'email' : 'sms',
      inPerson: isQr,
    });
    setSending(false);
    if (result.error) {
      notify(isQr ? 'Could not create the code' : 'Could not record the request', result.error);
      return;
    }
    if (isQr) {
      if (!result.id) {
        notify(
          'Could not create the code',
          'The request was saved without an id, so there is no review link to encode yet.',
        );
        return;
      }
      router.replace({
        pathname: '/review-qr',
        params: {
          id: result.id,
          name: name.trim(),
          job: job.title,
          local: result.scope === 'local' ? '1' : '0',
          unbranded: result.businessLinked ? '0' : '1',
        },
      });
      return;
    }
    // Recorded, NOT sent. The old copy here said the request was queued for
    // delivery; nothing in this product sends one (lib/review-requests.ts), so
    // the contractor was left waiting on a text that never went out.
    notify(
      'Recorded — nothing was sent',
      result.scope === 'local'
        ? `No ${channel === 'email' ? 'email' : 'text'} was sent: this app does not send messages, and in demo mode the request is only saved on this phone. It shows under Scheduled in the Reviews tab.`
        : `No ${channel === 'email' ? 'email' : 'text'} was sent: this app records requests, it does not send them. It is filed under Scheduled in the Reviews tab and in the web dashboard, which is where someone sends it. If the customer is still with you, go back and hand them a QR code instead.`,
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

          {/*
            Said once, up front, before any channel is chosen: this app records
            requests and hands over QR codes. It does not send messages. Same
            sentence as the Reviews tab, from the one place that owns it.
          */}
          <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.text }}>
                Best on the spot: a QR code
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
                {REVIEW_DELIVERY_NOTE}
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
                  {isQr
                    ? 'Phone or email (optional)'
                    : channel === 'sms'
                      ? 'Phone number *'
                      : 'Email address *'}
                </Text>
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  keyboardType={channel === 'sms' ? 'phone-pad' : 'email-address'}
                  autoCapitalize="none"
                  placeholder={channel === 'email' ? 'customer@email.com' : '(555) 555-0123'}
                  placeholderTextColor={colors.textMuted}
                  style={fieldStyle}
                />
              </View>
              <Segmented options={CHANNELS} value={channel} onChange={setChannel} />
            </Card>
          </Section>

          {isQr ? (
            <Section title="How it works">
              <Card style={{ gap: Spacing.sm }}>
                <Text style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 }}>
                  Nothing is sent. We create the review request and turn it into a QR code you can
                  hold up, print or stick on the invoice — the customer scans it and lands on your
                  review page.
                </Text>
                {qrBlocked ? (
                  <Text style={{ fontSize: 13, color: colors.dangerStrong, lineHeight: 19 }}>
                    This build has no web app address (EXPO_PUBLIC_APP_URL is unset), so there is no
                    review page to point the code at. Set it and rebuild. Text and email are not a
                    way around it — they only record the request, they don&apos;t send anything.
                  </Text>
                ) : null}
              </Card>
            </Section>
          ) : (
            <Section title={channel === 'email' ? 'Email to be sent' : 'Text to be sent'}>
              <Card style={{ gap: Spacing.sm }}>
                <Text style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 }}>
                  {previewMessage}
                </Text>
                {/*
                  This used to read as a preview of something about to go out.
                  The phone has no messaging code and nothing drains the table,
                  so recording is all that happens here — say so next to the
                  words the customer would have received.
                */}
                <Text style={{ fontSize: 13, color: colors.warningStrong, lineHeight: 19 }}>
                  Nothing is sent from the app. Recording the request files it under Scheduled, and
                  someone sends this message from the web dashboard — the app is a client for it, it
                  doesn&apos;t message customers itself.
                </Text>
              </Card>
            </Section>
          )}

          <Button
            label={isQr ? 'Create QR code' : 'Record request (no message sent)'}
            icon={isQr ? 'qr-code-outline' : 'bookmark-outline'}
            variant={isQr ? 'primary' : 'secondary'}
            loading={sending}
            disabled={isQr ? qrBlocked : !contact.trim()}
            onPress={() => void handleSend()}
          />
          {/* The way out of the two channels that do not reach anyone today. */}
          {!isQr ? (
            <Button
              label="Use a QR code instead"
              icon="qr-code-outline"
              disabled={sending}
              onPress={() => setChannel('qr')}
            />
          ) : null}
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
            {isQr
              ? 'The code opens the same ReviewGate page the web dashboard uses — the customer scans it and leaves the review right there.'
              : 'The request waits under Scheduled until a person sends it from the web dashboard. No text or email leaves this phone.'}
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
