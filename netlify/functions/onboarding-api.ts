import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl || "", supabaseKey || "");

async function getUserFromAuth(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) throw new Error("Missing Authorization header");
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token as any);
  if (error || !data.user) throw new Error("Invalid token");
  return data.user;
}

export const handler: Handler = async (event) => {
  try {
    const method = event.httpMethod;
    const qs = event.queryStringParameters || {};

    // Allow CORS preflight
    if (method === "OPTIONS") {
      return { statusCode: 200, body: "", headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } };
    }

    // GET tasks and user progress
    if (method === "GET" && qs.action === "tasks") {
      const user = await getUserFromAuth(event.headers.authorization);

      // Load all tasks
      const { data: tasks } = await supabase.from("onboarding_tasks").select("*").order("order_sequence", { ascending: true });

      // Load user progress for these tasks
      const { data: progress } = await supabase.from("user_task_progress").select("*").eq("user_id", user.id);

      // Compute progress
      const completedCount = progress?.filter((p: any) => p.status === "completed").length || 0;
      const totalRequired = tasks?.filter((t: any) => t.required).length || tasks?.length || 0;
      const progressPercent = totalRequired === 0 ? 100 : Math.round((completedCount / totalRequired) * 100);

      // Merge tasks + progress
      const tasksWithProgress = (tasks || []).map((t: any) => {
        const p = (progress || []).find((x: any) => x.task_id === t.id) || null;
        return { ...t, progress: p };
      });

      // Next recommended task: first required not completed
      const next = tasksWithProgress.find((t: any) => t.required && (!t.progress || t.progress.status !== "completed")) || null;

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, data: { tasks: tasksWithProgress, progressPercent, next } }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // POST complete a task
    if (method === "POST" && qs.action === "complete") {
      const user = await getUserFromAuth(event.headers.authorization);
      const body = event.body ? JSON.parse(event.body) : {};
      const { task_id, status = "completed", skip_reason } = body;
      if (!task_id) return { statusCode: 400, body: JSON.stringify({ success: false, error: "task_id is required" }) };

      // Fetch task to get reward
      const { data: task } = await supabase.from("onboarding_tasks").select("*").eq("id", task_id).single();
      if (!task) return { statusCode: 404, body: JSON.stringify({ success: false, error: "Task not found" }) };

      // Upsert user_task_progress
      const { error: upsertErr } = await supabase.from("user_task_progress").upsert({
        user_id: user.id,
        task_id,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        skip_reason: skip_reason || null,
      }, { onConflict: ["user_id", "task_id"] });

      if (upsertErr) throw upsertErr;

      // If completed and tokens not yet awarded, award tokens
      if (status === "completed" && task.token_reward && Number(task.token_reward) > 0) {
        // Check if tokens already awarded for this task
        const { data: existing } = await supabase.from("tokens_history").select("*").eq("user_id", user.id).eq("task_id", task_id);
        if (!existing || existing.length === 0) {
          // Award tokens: insert tokens_history and increment profile
          const { error: tokenErr } = await supabase.from("tokens_history").insert([{ user_id: user.id, task_id, amount: Number(task.token_reward), reason: `Task: ${task.task_name}` }]);
          if (tokenErr) console.error("Failed to insert token history:", tokenErr);

          const { error: profileErr } = await supabase.rpc("", {} as any).catch(() => null);
          // Update profile token_balance and total_tokens_earned via SQL update
          const { error: pErr } = await supabase.from("profiles").update({
            token_balance: supabase.raw("COALESCE(token_balance,0) + ?", [Number(task.token_reward)]),
            total_tokens_earned: supabase.raw("COALESCE(total_tokens_earned,0) + ?", [Number(task.token_reward)])
          }).eq("id", user.id as any);
          // If supabase.raw isn't supported in this context, fallback to select+update
          if (pErr) {
            // Fallback read-modify-write
            const { data: profile } = await supabase.from("profiles").select("token_balance, total_tokens_earned").eq("id", user.id).single();
            const newBalance = (profile?.token_balance || 0) + Number(task.token_reward);
            const newTotal = (profile?.total_tokens_earned || 0) + Number(task.token_reward);
            await supabase.from("profiles").update({ token_balance: newBalance, total_tokens_earned: newTotal }).eq("id", user.id);
          }
        }
      }

      // Recompute overall onboarding progress and mark onboarding_completed if 100%
      const { data: allTasks } = await supabase.from("onboarding_tasks").select("*");
      const requiredCount = (allTasks || []).filter((t: any) => t.required).length || 0;
      const { data: userProgress } = await supabase.from("user_task_progress").select("*").eq("user_id", user.id);
      const completedCount = (userProgress || []).filter((p: any) => p.status === "completed").length || 0;
      const progressPercent = requiredCount === 0 ? 100 : Math.round((completedCount / requiredCount) * 100);

      if (progressPercent >= 100) {
        await supabase.from("profiles").update({ onboarding_completed: true, onboarding_progress: progressPercent }).eq("id", user.id);
      } else {
        await supabase.from("profiles").update({ onboarding_progress: progressPercent }).eq("id", user.id);
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, progressPercent }), headers: { "Content-Type": "application/json" } };
    }

    return { statusCode: 404, body: JSON.stringify({ success: false, error: "Not found" }), headers: { "Content-Type": "application/json" } };
  } catch (error: any) {
    console.error("onboarding-api error:", error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || "Server error" }), headers: { "Content-Type": "application/json" } };
  }
};
