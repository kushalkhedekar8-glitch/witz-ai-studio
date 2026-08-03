import { supabase } from "@/integrations/supabase/client";

export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
};

export type Conversation = {
  id: string;
  title: string;
  engine: string;
  updated_at: string;
};

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,engine,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadMessages(conversationId: string): Promise<ChatMsg[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("role,content,attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    attachments: m.attachments ?? [],
  }));
}

export async function createConversation(
  userId: string,
  title: string,
  engine: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title: title.slice(0, 60), engine })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function saveMessage(
  conversationId: string,
  userId: string,
  msg: ChatMsg,
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    attachments: msg.attachments ?? [],
  });
  if (error) throw new Error(error.message);
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
