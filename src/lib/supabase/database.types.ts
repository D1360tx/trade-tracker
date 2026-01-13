export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            trades: {
                Row: {
                    id: string
                    user_id: string
                    exchange: string
                    ticker: string
                    type: string
                    direction: string
                    entry_price: number
                    exit_price: number
                    quantity: number
                    entry_date: string
                    exit_date: string
                    status: string
                    pnl: number
                    pnl_percentage: number
                    fees: number
                    notes: string | null
                    strategy_id: string | null
                    mistakes: string[] | null
                    initial_risk: number | null
                    leverage: number | null
                    notional: number | null
                    margin: number | null
                    is_bot: boolean | null
                    external_oid: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    exchange: string
                    ticker: string
                    type: string
                    direction: string
                    entry_price: number
                    exit_price: number
                    quantity: number
                    entry_date: string
                    exit_date: string
                    status: string
                    pnl: number
                    pnl_percentage: number
                    fees: number
                    notes?: string | null
                    strategy_id?: string | null
                    mistakes?: string[] | null
                    initial_risk?: number | null
                    leverage?: number | null
                    notional?: number | null
                    margin?: number | null
                    is_bot?: boolean | null
                    external_oid?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    exchange?: string
                    ticker?: string
                    type?: string
                    direction?: string
                    entry_price?: number
                    exit_price?: number
                    quantity?: number
                    entry_date?: string
                    exit_date?: string
                    status?: string
                    pnl?: number
                    pnl_percentage?: number
                    fees?: number
                    notes?: string | null
                    strategy_id?: string | null
                    mistakes?: string[] | null
                    initial_risk?: number | null
                    leverage?: number | null
                    notional?: number | null
                    margin?: number | null
                    is_bot?: boolean | null
                    external_oid?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            strategies: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    color: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    description?: string | null
                    color: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    description?: string | null
                    color?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            mistakes: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    color: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    description?: string | null
                    color: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    description?: string | null
                    color?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            user_settings: {
                Row: {
                    id: string
                    user_id: string
                    column_order: Json | null
                    default_filters: Json | null
                    notification_preferences: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    column_order?: Json | null
                    default_filters?: Json | null
                    notification_preferences?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    column_order?: Json | null
                    default_filters?: Json | null
                    notification_preferences?: Json | null
                    created_at?: string
                    updated_at?: string
                }
            }
            api_credentials: {
                Row: {
                    id: string
                    user_id: string
                    exchange: string
                    api_key: string
                    api_secret: string
                    is_active: boolean | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    exchange: string
                    api_key: string
                    api_secret: string
                    is_active?: boolean | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    exchange?: string
                    api_key?: string
                    api_secret?: string
                    is_active?: boolean | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
