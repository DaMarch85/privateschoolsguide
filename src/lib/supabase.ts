import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rmxsymdoprmgjgmwwaop.supabase.co'
const supabaseAnonKey = 'sb_publishable_5E2f_ZiLhWjxShJbpNyWyQ_YRF_sjI_'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
