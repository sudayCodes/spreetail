export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type GroupType = 'direct' | 'group'
export type SplitType = 'equal' | 'unequal' | 'percentage' | 'share'
export type ExpenseCategory = 'food' | 'travel' | 'hotel' | 'entertainment' | 'other'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id: string; name: string; created_at?: string }
        Update: { name?: string }
        Relationships: []
      }
      groups: {
        Row: { id: string; name: string; type: GroupType; invite_token: string; created_at: string }
        Insert: { id?: string; name: string; type?: GroupType; invite_token?: string; created_at?: string }
        Update: { name?: string }
        Relationships: []
      }
      group_members: {
        Row: { group_id: string; user_id: string; joined_at: string }
        Insert: { group_id: string; user_id: string; joined_at?: string }
        Update: never
        Relationships: []
      }
      expenses: {
        Row: {
          id: string; group_id: string; paid_by: string; description: string
          total_amount: number; split_type: SplitType; category: ExpenseCategory
          created_at: string; updated_at: string; updated_by: string | null
        }
        Insert: {
          id?: string; group_id: string; paid_by: string; description: string
          total_amount: number; split_type?: SplitType; category?: ExpenseCategory
          created_at?: string; updated_at?: string; updated_by?: string | null
        }
        Update: {
          description?: string; total_amount?: number; split_type?: SplitType
          category?: ExpenseCategory; paid_by?: string; updated_at?: string; updated_by?: string | null
        }
        Relationships: []
      }
      expense_splits: {
        Row: { id: string; expense_id: string; user_id: string; amount_owed: number }
        Insert: { id?: string; expense_id: string; user_id: string; amount_owed: number }
        Update: { amount_owed?: number }
        Relationships: []
      }
      settlements: {
        Row: { id: string; group_id: string; payer_id: string; receiver_id: string; amount: number; created_at: string }
        Insert: { id?: string; group_id: string; payer_id: string; receiver_id: string; amount: number; created_at?: string }
        Update: never
        Relationships: []
      }
      messages: {
        Row: { id: string; group_id: string; sender_id: string; content: string; created_at: string }
        Insert: { id?: string; group_id: string; sender_id: string; content: string; created_at?: string }
        Update: never
        Relationships: []
      }
      activity_log: {
        Row: { id: string; group_id: string; actor_id: string; action_type: string; description: string; created_at: string }
        Insert: { id?: string; group_id: string; actor_id: string; action_type: string; description: string; created_at?: string }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      get_user_group_balance: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: number
      }
      get_group_balances: {
        Args: { p_group_id: string }
        Returns: { user_id: string; name: string; balance: number }[]
      }
      get_pairwise_debts: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: { creditor_id: string; creditor_name: string; net_owed: number }[]
      }
      is_group_member: {
        Args: { gid: string }
        Returns: boolean
      }
    }
    Enums: {
      group_type: GroupType
      split_type: SplitType
      expense_category: ExpenseCategory
    }
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseSplit = Database['public']['Tables']['expense_splits']['Row']
export type Settlement = Database['public']['Tables']['settlements']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type ActivityLog = Database['public']['Tables']['activity_log']['Row']
