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
      firstyear: {
        Row: {
          sex: string | null
          s_no: number
          roll_no: string
          enrollment_no: string | null
          student_name: string | null
          father_name: string | null
          mother_name: string | null
          branch: string | null
          password: string | null
          abc_id: string
          admit_card_path: string
          photo_path: string
          mobile_no: string | null
          student_emailid: string | null
          student_password: string | null
          otp_verified: boolean | null
          student_group: string | null
          student_section: string | null
        }
        Insert: {
          sex?: string | null
          s_no?: number
          roll_no: string
          enrollment_no?: string | null
          student_name?: string | null
          father_name?: string | null
          mother_name?: string | null
          branch?: string | null
          password?: string | null
          abc_id: string
          admit_card_path: string
          photo_path: string
          mobile_no?: string | null
          student_emailid?: string | null
          student_password?: string | null
          otp_verified?: boolean | null
          student_group?: string | null
          student_section?: string | null
        }
        Update: {
          sex?: string | null
          s_no?: number
          roll_no?: string
          enrollment_no?: string | null
          student_name?: string | null
          father_name?: string | null
          mother_name?: string | null
          branch?: string | null
          password?: string | null
          abc_id?: string
          admit_card_path?: string
          photo_path?: string
          mobile_no?: string | null
          student_emailid?: string | null
          student_password?: string | null
          otp_verified?: boolean | null
          student_group?: string | null
          student_section?: string | null
        }
      }
    }
  }
}

export type Student = Database['public']['Tables']['firstyear']['Row']
