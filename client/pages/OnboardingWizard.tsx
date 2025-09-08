import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import supabaseClient from '@/lib/supabaseClient';

export default function OnboardingWizard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    const session = await supabaseClient.auth.getSession();
    const token = session.data?.session?.access_token;
    const res = await fetch('/.netlify/functions/onboarding-api?action=tasks', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = await res.json();
    setTasks(json.data.tasks || []);
    setProgress(json.data.progressPercent || 0);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const completeTask = async (taskId: string) => {
    setLoading(true);
    const session = await supabaseClient.auth.getSession();
    const token = session.data?.session?.access_token;
    const res = await fetch('/.netlify/functions/onboarding-api?action=complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task_id: taskId, status: 'completed' }),
    });
    if (res.ok) {
      const json = await res.json();
      setProgress(json.progressPercent || 0);
      await fetchTasks();
    }
    setLoading(false);
  };

  return (
    <AppLayout title="Onboarding" breadcrumbs={[{ label: 'Onboarding', href: '/onboarding' }]}>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome — Onboarding Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Completion</h3>
                  <p className="text-sm text-muted-foreground">Complete tasks to earn tokens and unlock features.</p>
                </div>
                <div className="w-40">
                  <div className="text-right font-medium">{progress}%</div>
                </div>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="p-3 border rounded">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{t.task_name}</div>
                      <div className="text-sm text-muted-foreground">{t.description}</div>
                      <div className="text-xs text-muted-foreground">Reward: {t.token_reward} tokens</div>
                    </div>
                    <div>
                      {t.progress && t.progress.status === 'completed' ? (
                        <div className="text-green-600 font-medium">Completed</div>
                      ) : (
                        <Button onClick={() => completeTask(t.id)} disabled={loading}>Complete</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
