import { supabase } from "./supabase";

export type ActionType = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'CREATE_OBJECT' 
  | 'DELETE_REQUEST'
  | 'HARD_DELETE'
  | 'RESTORE'
  | 'UPDATE_STATUS'
  | 'ADD_COMMENT'
  | 'EDIT_COMMENT'
  | 'DELETE_COMMENT'
  | 'ADD_REMINDER'
  | 'ADD_CITY'
  | 'PAGE_VISIT'
  | 'EDIT_OBJECT'
  | 'CREATE_USER'
  | 'DELETE_USER';

export async function logAction(
  userName: string,
  actionType: ActionType,
  entityId?: string,
  entityName?: string,
  details?: any
) {
  try {
    if (!userName) return;
    
    await supabase.from("action_logs").insert([
      {
        user_name: userName,
        action_type: actionType,
        entity_id: entityId || null,
        entity_name: entityName || null,
        details: details || {}
      }
    ]);
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}
