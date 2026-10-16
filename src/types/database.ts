
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"correlation_id": string | null,"created_at": string,"id": number,"metadata": NonNullable<Json>,"org_id": string,"target_id": string | null,"target_type": string | null,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"correlation_id"?: string | null,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"org_id": string,"target_id"?: string | null,"target_type"?: string | null,"team_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"correlation_id"?: string | null,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"org_id"?: string,"target_id"?: string | null,"target_type"?: string | null,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"org_id": string,"org_role": Database["public"]['Enums']["org_role"],"revoked_at": string | null,"revoked_by": string | null,"team_id": string | null,"team_role": Database["public"]['Enums']["team_role"] | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by": string,"org_id": string,"org_role"?: Database["public"]['Enums']["org_role"],"revoked_at"?: string | null,"revoked_by"?: string | null,"team_id"?: string | null,"team_role"?: Database["public"]['Enums']["team_role"] | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"org_id"?: string,"org_role"?: Database["public"]['Enums']["org_role"],"revoked_at"?: string | null,"revoked_by"?: string | null,"team_id"?: string | null,"team_role"?: Database["public"]['Enums']["team_role"] | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "invitations_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"library_items": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"description": string | null,"id": string,"kind": Database["public"]['Enums']["library_kind"],"org_id": string,"owner_id": string,"project_id": string | null,"tags": (string)[],"team_id": string,"title": string,"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["library_kind"],"org_id": string,"owner_id": string,"project_id"?: string | null,"tags"?: (string)[],"team_id": string,"title": string,"updated_at"?: string,"url": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["library_kind"],"org_id"?: string,"owner_id"?: string,"project_id"?: string | null,"tags"?: (string)[],"team_id"?: string,"title"?: string,"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_items_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "library_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_items_team_id_project_id_fkey"
      columns: ["team_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "completion_criterion": string | null,"created_at": string,"done": boolean,"due_date": string | null,"id": string,"name": string,"owner_id": string | null,"position": number,"project_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completion_criterion"?: string | null,"created_at"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"name": string,"owner_id"?: string | null,"position"?: number,"project_id": string,"team_id": string
                  }
                  Update: {
                    "completion_criterion"?: string | null,"created_at"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string | null,"position"?: number,"project_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_team_id_owner_id_fkey"
      columns: ["team_id","owner_id"]
isOneToOne: false
      referencedRelation: "team_memberships"
      referencedColumns: ["team_id","profile_id"]
    },{
      foreignKeyName: "milestones_team_id_project_id_fkey"
      columns: ["team_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"dedupe_key": string | null,"id": number,"kind": string,"org_id": string,"read_at": string | null,"recipient_id": string,"resource_id": string,"resource_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"id"?: never,"kind": string,"org_id": string,"read_at"?: string | null,"recipient_id": string,"resource_id": string,"resource_type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"id"?: never,"kind"?: string,"org_id"?: string,"read_at"?: string | null,"recipient_id"?: string,"resource_id"?: string,"resource_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_memberships": {
                  Row: {
                    "can_request": boolean,"created_at": string,"org_id": string,"profile_id": string,"role": Database["public"]['Enums']["org_role"],"state": Database["public"]['Enums']["member_state"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_request"?: boolean,"created_at"?: string,"org_id": string,"profile_id": string,"role"?: Database["public"]['Enums']["org_role"],"state"?: Database["public"]['Enums']["member_state"],"updated_at"?: string
                  }
                  Update: {
                    "can_request"?: boolean,"created_at"?: string,"org_id"?: string,"profile_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"state"?: Database["public"]['Enums']["member_state"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"parking_ideas": {
                  Row: {
                    "body": string | null,"created_at": string,"creator_id": string,"id": string,"org_id": string,"pinned": boolean,"promoted_request_id": string | null,"promoted_task_id": string | null,"state": Database["public"]['Enums']["idea_state"],"tags": (string)[],"team_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"creator_id": string,"id"?: string,"org_id": string,"pinned"?: boolean,"promoted_request_id"?: string | null,"promoted_task_id"?: string | null,"state"?: Database["public"]['Enums']["idea_state"],"tags"?: (string)[],"team_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"creator_id"?: string,"id"?: string,"org_id"?: string,"pinned"?: boolean,"promoted_request_id"?: string | null,"promoted_task_id"?: string | null,"state"?: Database["public"]['Enums']["idea_state"],"tags"?: (string)[],"team_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parking_ideas_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parking_ideas_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "parking_ideas_promoted_request_id_fkey"
      columns: ["promoted_request_id"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parking_ideas_team_id_promoted_task_id_fkey"
      columns: ["team_id","promoted_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"email": string,"id": string,"level": string | null,"theme": Database["public"]['Enums']["theme_pref"],"timezone": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"email": string,"id": string,"level"?: string | null,"theme"?: Database["public"]['Enums']["theme_pref"],"timezone"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"email"?: string,"id"?: string,"level"?: string | null,"theme"?: Database["public"]['Enums']["theme_pref"],"timezone"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string,"health": Database["public"]['Enums']["project_health"] | null,"id": string,"latest_update": string | null,"latest_update_at": string | null,"latest_update_by": string | null,"lead_id": string | null,"name": string,"org_id": string,"purpose": string | null,"start_date": string | null,"status": Database["public"]['Enums']["project_status"],"target_date": string | null,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by": string,"health"?: Database["public"]['Enums']["project_health"] | null,"id"?: string,"latest_update"?: string | null,"latest_update_at"?: string | null,"latest_update_by"?: string | null,"lead_id"?: string | null,"name": string,"org_id": string,"purpose"?: string | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"target_date"?: string | null,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string,"health"?: Database["public"]['Enums']["project_health"] | null,"id"?: string,"latest_update"?: string | null,"latest_update_at"?: string | null,"latest_update_by"?: string | null,"lead_id"?: string | null,"name"?: string,"org_id"?: string,"purpose"?: string | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"target_date"?: string | null,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_latest_update_by_fkey"
      columns: ["latest_update_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "projects_team_id_lead_id_fkey"
      columns: ["team_id","lead_id"]
isOneToOne: false
      referencedRelation: "team_memberships"
      referencedColumns: ["team_id","profile_id"]
    }
                  ]
                },"task_activity": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"data": NonNullable<Json>,"event": string,"id": number,"task_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"event": string,"id"?: never,"task_id": string,"team_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"event"?: string,"id"?: never,"task_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_activity_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_activity_team_id_task_id_fkey"
      columns: ["team_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"task_checklist_items": {
                  Row: {
                    "body": string,"created_at": string,"done": boolean,"done_at": string | null,"done_by": string | null,"id": string,"position": number,"task_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"done"?: boolean,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"position"?: number,"task_id": string,"team_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"done"?: boolean,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"position"?: number,"task_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_checklist_items_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_checklist_items_team_id_task_id_fkey"
      columns: ["team_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"task_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"id": string,"task_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"task_id": string,"team_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"task_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_comments_team_id_task_id_fkey"
      columns: ["team_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"task_dependencies": {
                  Row: {
                    "blocked_task_id": string,"blocked_team_id": string,"blocker_task_id": string,"blocker_team_id": string,"created_at": string,"created_by": string,"id": string,"org_id": string,"removed_at": string | null,"removed_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_task_id": string,"blocked_team_id": string,"blocker_task_id": string,"blocker_team_id": string,"created_at"?: string,"created_by": string,"id"?: string,"org_id": string,"removed_at"?: string | null,"removed_by"?: string | null
                  }
                  Update: {
                    "blocked_task_id"?: string,"blocked_team_id"?: string,"blocker_task_id"?: string,"blocker_team_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"org_id"?: string,"removed_at"?: string | null,"removed_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_dependencies_blocked_team_id_blocked_task_id_fkey"
      columns: ["blocked_team_id","blocked_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "task_dependencies_blocker_team_id_blocker_task_id_fkey"
      columns: ["blocker_team_id","blocker_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "task_dependencies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_org_id_blocked_team_id_fkey"
      columns: ["org_id","blocked_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "task_dependencies_org_id_blocker_team_id_fkey"
      columns: ["org_id","blocker_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "task_dependencies_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_label_links": {
                  Row: {
                    "label_id": string,"task_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "label_id": string,"task_id": string,"team_id": string
                  }
                  Update: {
                    "label_id"?: string,"task_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_label_links_team_id_label_id_fkey"
      columns: ["team_id","label_id"]
isOneToOne: false
      referencedRelation: "task_labels"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "task_label_links_team_id_task_id_fkey"
      columns: ["team_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"task_labels": {
                  Row: {
                    "id": string,"name": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"team_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_labels_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"task_status_transitions": {
                  Row: {
                    "from_status": string,"team_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "from_status": string,"team_id": string,"to_status": string
                  }
                  Update: {
                    "from_status"?: string,"team_id"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_status_transitions_team_id_from_status_fkey"
      columns: ["team_id","from_status"]
isOneToOne: false
      referencedRelation: "task_statuses"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "task_status_transitions_team_id_to_status_fkey"
      columns: ["team_id","to_status"]
isOneToOne: false
      referencedRelation: "task_statuses"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"task_statuses": {
                  Row: {
                    "category": Database["public"]['Enums']["status_category"],"id": string,"key": string,"label": string,"position": number,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["status_category"],"id"?: string,"key": string,"label": string,"position": number,"team_id": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["status_category"],"id"?: string,"key"?: string,"label"?: string,"position"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_statuses_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"assignee_id": string | null,"blocked": boolean,"blocked_reason": string | null,"completed_at": string | null,"created_at": string,"creator_id": string,"description": string | null,"due_date": string | null,"estimate_points": number | null,"id": string,"issue_key": string,"milestone_id": string | null,"number": number,"org_id": string,"parent_id": string | null,"priority": Database["public"]['Enums']["task_priority"],"project_id": string | null,"rank": number,"reviewer_id": string | null,"start_date": string | null,"status_id": string,"team_id": string,"title": string,"type": Database["public"]['Enums']["task_type"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"assignee_id"?: string | null,"blocked"?: boolean,"blocked_reason"?: string | null,"completed_at"?: string | null,"created_at"?: string,"creator_id": string,"description"?: string | null,"due_date"?: string | null,"estimate_points"?: number | null,"id"?: string,"issue_key": string,"milestone_id"?: string | null,"number": number,"org_id": string,"parent_id"?: string | null,"priority"?: Database["public"]['Enums']["task_priority"],"project_id"?: string | null,"rank": number,"reviewer_id"?: string | null,"start_date"?: string | null,"status_id": string,"team_id": string,"title": string,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"assignee_id"?: string | null,"blocked"?: boolean,"blocked_reason"?: string | null,"completed_at"?: string | null,"created_at"?: string,"creator_id"?: string,"description"?: string | null,"due_date"?: string | null,"estimate_points"?: number | null,"id"?: string,"issue_key"?: string,"milestone_id"?: string | null,"number"?: number,"org_id"?: string,"parent_id"?: string | null,"priority"?: Database["public"]['Enums']["task_priority"],"project_id"?: string | null,"rank"?: number,"reviewer_id"?: string | null,"start_date"?: string | null,"status_id"?: string,"team_id"?: string,"title"?: string,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "tasks_team_id_assignee_id_fkey"
      columns: ["team_id","assignee_id"]
isOneToOne: false
      referencedRelation: "team_memberships"
      referencedColumns: ["team_id","profile_id"]
    },{
      foreignKeyName: "tasks_team_id_parent_id_fkey"
      columns: ["team_id","parent_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "tasks_team_id_project_id_fkey"
      columns: ["team_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "tasks_team_id_project_id_milestone_id_fkey"
      columns: ["team_id","project_id","milestone_id"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["team_id","project_id","id"]
    },{
      foreignKeyName: "tasks_team_id_reviewer_id_fkey"
      columns: ["team_id","reviewer_id"]
isOneToOne: false
      referencedRelation: "team_memberships"
      referencedColumns: ["team_id","profile_id"]
    },{
      foreignKeyName: "tasks_team_id_status_id_fkey"
      columns: ["team_id","status_id"]
isOneToOne: false
      referencedRelation: "task_statuses"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"team_access_grants": {
                  Row: {
                    "approver_id": string | null,"created_at": string,"decided_at": string | null,"decision_note": string | null,"expires_at": string | null,"grantee_id": string,"id": string,"issuer_id": string,"org_id": string,"reason": string,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"scope": Database["public"]['Enums']["grant_scope"],"status": Database["public"]['Enums']["grant_status"],"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approver_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decision_note"?: string | null,"expires_at"?: string | null,"grantee_id": string,"id"?: string,"issuer_id": string,"org_id": string,"reason": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"scope": Database["public"]['Enums']["grant_scope"],"status": Database["public"]['Enums']["grant_status"],"team_id": string
                  }
                  Update: {
                    "approver_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decision_note"?: string | null,"expires_at"?: string | null,"grantee_id"?: string,"id"?: string,"issuer_id"?: string,"org_id"?: string,"reason"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"scope"?: Database["public"]['Enums']["grant_scope"],"status"?: Database["public"]['Enums']["grant_status"],"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_access_grants_approver_id_fkey"
      columns: ["approver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_access_grants_org_id_grantee_id_fkey"
      columns: ["org_id","grantee_id"]
isOneToOne: false
      referencedRelation: "organization_memberships"
      referencedColumns: ["org_id","profile_id"]
    },{
      foreignKeyName: "team_access_grants_org_id_issuer_id_fkey"
      columns: ["org_id","issuer_id"]
isOneToOne: false
      referencedRelation: "organization_memberships"
      referencedColumns: ["org_id","profile_id"]
    },{
      foreignKeyName: "team_access_grants_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "team_access_grants_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_issue_counters": {
                  Row: {
                    "next_number": number,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "next_number"?: number,"team_id": string
                  }
                  Update: {
                    "next_number"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_issue_counters_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_memberships": {
                  Row: {
                    "active": boolean,"added_by": string | null,"created_at": string,"org_id": string,"profile_id": string,"removed_at": string | null,"role": Database["public"]['Enums']["team_role"],"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"added_by"?: string | null,"created_at"?: string,"org_id": string,"profile_id": string,"removed_at"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"team_id": string
                  }
                  Update: {
                    "active"?: boolean,"added_by"?: string | null,"created_at"?: string,"org_id"?: string,"profile_id"?: string,"removed_at"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_memberships_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_org_id_profile_id_fkey"
      columns: ["org_id","profile_id"]
isOneToOne: false
      referencedRelation: "organization_memberships"
      referencedColumns: ["org_id","profile_id"]
    },{
      foreignKeyName: "team_memberships_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "team_memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "accepts_requests": boolean,"archived_at": string | null,"created_at": string,"description": string | null,"id": string,"issue_prefix": string,"name": string,"org_id": string,"slug": string,"wip_limit_in_progress": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_requests"?: boolean,"archived_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"issue_prefix": string,"name": string,"org_id": string,"slug": string,"wip_limit_in_progress"?: number | null
                  }
                  Update: {
                    "accepts_requests"?: boolean,"archived_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"issue_prefix"?: string,"name"?: string,"org_id"?: string,"slug"?: string,"wip_limit_in_progress"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"time_entries": {
                  Row: {
                    "corrected_at": string | null,"created_at": string,"deleted_at": string | null,"duration_seconds": number | null,"ended_at": string | null,"id": string,"note": string | null,"org_id": string,"request_id": string | null,"source": Database["public"]['Enums']["time_entry_source"],"started_at": string,"stop_reason": Database["public"]['Enums']["time_stop_reason"] | null,"task_id": string,"team_id": string,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "corrected_at"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"duration_seconds"?: never,"ended_at"?: string | null,"id"?: string,"note"?: string | null,"org_id": string,"request_id"?: string | null,"source": Database["public"]['Enums']["time_entry_source"],"started_at": string,"stop_reason"?: Database["public"]['Enums']["time_stop_reason"] | null,"task_id": string,"team_id": string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "corrected_at"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"duration_seconds"?: never,"ended_at"?: string | null,"id"?: string,"note"?: string | null,"org_id"?: string,"request_id"?: string | null,"source"?: Database["public"]['Enums']["time_entry_source"],"started_at"?: string,"stop_reason"?: Database["public"]['Enums']["time_stop_reason"] | null,"task_id"?: string,"team_id"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_entries_org_id_team_id_fkey"
      columns: ["org_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "time_entries_org_id_user_id_fkey"
      columns: ["org_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_memberships"
      referencedColumns: ["org_id","profile_id"]
    },{
      foreignKeyName: "time_entries_team_id_task_id_fkey"
      columns: ["team_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"time_entry_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"data": NonNullable<Json>,"entry_id": string,"event": string,"id": number,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entry_id": string,"event": string,"id"?: never,"team_id": string,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entry_id"?: string,"event"?: string,"id"?: never,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_entry_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entry_events_team_id_entry_id_fkey"
      columns: ["team_id","entry_id"]
isOneToOne: false
      referencedRelation: "time_entries"
      referencedColumns: ["team_id","id"]
    },{
      foreignKeyName: "time_entry_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"work_request_audience": {
                  Row: {
                    "added_by": string | null,"created_at": string,"profile_id": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"profile_id": string,"request_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"profile_id"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_request_audience_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_audience_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_audience_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"work_request_internal_notes": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"request_id": string,"target_team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"request_id": string,"target_team_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"request_id"?: string,"target_team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_request_internal_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_internal_notes_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_internal_notes_target_team_id_fkey"
      columns: ["target_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"work_request_messages": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"request_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_request_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_messages_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"work_request_status_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["request_status"] | null,"id": number,"kind": string,"public_summary": string | null,"request_id": string,"to_status": Database["public"]['Enums']["request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["request_status"] | null,"id"?: never,"kind": string,"public_summary"?: string | null,"request_id": string,"to_status": Database["public"]['Enums']["request_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["request_status"] | null,"id"?: never,"kind"?: string,"public_summary"?: string | null,"request_id"?: string,"to_status"?: Database["public"]['Enums']["request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_request_status_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_status_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"work_request_task_links": {
                  Row: {
                    "created_at": string,"linked_by": string | null,"request_id": string,"task_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"linked_by"?: string | null,"request_id": string,"task_id": string,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"linked_by"?: string | null,"request_id"?: string,"task_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_request_task_links_linked_by_fkey"
      columns: ["linked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_task_links_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_task_links_team_id_task_id_fkey"
      columns: ["team_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["team_id","id"]
    }
                  ]
                },"work_request_triage": {
                  Row: {
                    "request_id": string,"target_team_id": string,"triage_owner_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "request_id": string,"target_team_id": string,"triage_owner_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "request_id"?: string,"target_team_id"?: string,"triage_owner_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_request_triage_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_triage_target_team_id_fkey"
      columns: ["target_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_request_triage_target_team_id_triage_owner_id_fkey"
      columns: ["target_team_id","triage_owner_id"]
isOneToOne: false
      referencedRelation: "team_memberships"
      referencedColumns: ["team_id","profile_id"]
    }
                  ]
                },"work_requests": {
                  Row: {
                    "acceptance_criteria": string | null,"client_key": string,"committed_date": string | null,"committed_priority": Database["public"]['Enums']["task_priority"] | null,"created_at": string,"duplicate_of": string | null,"id": string,"last_public_update_at": string | null,"links": string | null,"number": number,"org_id": string,"outcome": string,"outcome_reason": string | null,"problem": string,"requested_date": string | null,"requested_priority": Database["public"]['Enums']["task_priority"],"source_team_id": string | null,"status": Database["public"]['Enums']["request_status"],"submitted_at": string | null,"submitter_id": string,"target_team_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acceptance_criteria"?: string | null,"client_key": string,"committed_date"?: string | null,"committed_priority"?: Database["public"]['Enums']["task_priority"] | null,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"last_public_update_at"?: string | null,"links"?: string | null,"number"?: never,"org_id": string,"outcome": string,"outcome_reason"?: string | null,"problem": string,"requested_date"?: string | null,"requested_priority"?: Database["public"]['Enums']["task_priority"],"source_team_id"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string | null,"submitter_id": string,"target_team_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "acceptance_criteria"?: string | null,"client_key"?: string,"committed_date"?: string | null,"committed_priority"?: Database["public"]['Enums']["task_priority"] | null,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"last_public_update_at"?: string | null,"links"?: string | null,"number"?: never,"org_id"?: string,"outcome"?: string,"outcome_reason"?: string | null,"problem"?: string,"requested_date"?: string | null,"requested_priority"?: Database["public"]['Enums']["task_priority"],"source_team_id"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string | null,"submitter_id"?: string,"target_team_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_requests_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "work_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_requests_org_id_source_team_id_fkey"
      columns: ["org_id","source_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "work_requests_org_id_target_team_id_fkey"
      columns: ["org_id","target_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["org_id","id"]
    },{
      foreignKeyName: "work_requests_submitter_id_fkey"
      columns: ["submitter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token_hash": string }; Returns: string
                           },
"accept_work_request":
{ Args: { "p_committed_date"?: string,"p_committed_priority": Database["public"]['Enums']["task_priority"],"p_expected": Database["public"]['Enums']["request_status"],"p_public_summary"?: string,"p_request": string,"p_tasks"?: Json }; Returns: (string)[]
                           },
"add_request_audience":
{ Args: { "p_profile": string,"p_request": string }; Returns: undefined
                           },
"add_task_dependency":
{ Args: { "p_direction": string,"p_other_key": string,"p_task": string }; Returns: {
              "blocked_task_id": string,
"blocked_team_id": string,
"blocker_task_id": string,
"blocker_team_id": string,
"created_at": string,
"created_by": string,
"id": string,
"org_id": string,
"removed_at": string | null,
"removed_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "task_dependencies"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_time_entry":
{ Args: { "p_ended_at": string,"p_note"?: string,"p_request_id"?: string,"p_started_at": string,"p_task": string }; Returns: {
              "corrected_at": string | null,
"created_at": string,
"deleted_at": string | null,
"duration_seconds": number | null,
"ended_at": string | null,
"id": string,
"note": string | null,
"org_id": string,
"request_id": string | null,
"source": Database["public"]['Enums']["time_entry_source"],
"started_at": string,
"stop_reason": Database["public"]['Enums']["time_stop_reason"] | null,
"task_id": string,
"team_id": string,
"updated_at": string,
"user_id": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "time_entries"
        isOneToOne: false
        isSetofReturn: true
      } },
"admin_add_team_member":
{ Args: { "p_profile": string,"p_role": Database["public"]['Enums']["team_role"],"p_team": string }; Returns: undefined
                           },
"admin_remove_team_member":
{ Args: { "p_profile": string,"p_team": string }; Returns: undefined
                           },
"admin_set_member_state":
{ Args: { "p_org": string,"p_profile": string,"p_state": Database["public"]['Enums']["member_state"] }; Returns: undefined
                           },
"admin_set_team_role":
{ Args: { "p_profile": string,"p_role": Database["public"]['Enums']["team_role"],"p_team": string }; Returns: undefined
                           },
"correct_time_entry":
{ Args: { "p_ended_at": string,"p_entry": string,"p_expected_version": number,"p_note"?: string,"p_started_at": string }; Returns: {
              "corrected_at": string | null,
"created_at": string,
"deleted_at": string | null,
"duration_seconds": number | null,
"ended_at": string | null,
"id": string,
"note": string | null,
"org_id": string,
"request_id": string | null,
"source": Database["public"]['Enums']["time_entry_source"],
"started_at": string,
"stop_reason": Database["public"]['Enums']["time_stop_reason"] | null,
"task_id": string,
"team_id": string,
"updated_at": string,
"user_id": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "time_entries"
        isOneToOne: false
        isSetofReturn: true
      } },
"create_invitation":
{ Args: { "p_email": string,"p_org": string,"p_org_role": Database["public"]['Enums']["org_role"],"p_team"?: string,"p_team_role"?: Database["public"]['Enums']["team_role"],"p_token_hash": string,"p_valid_days"?: number }; Returns: string
                           },
"current_timer":
{ Args: Record<PropertyKey, never>; Returns: {
              "corrected_at": string | null,
"created_at": string,
"deleted_at": string | null,
"duration_seconds": number | null,
"ended_at": string | null,
"id": string,
"note": string | null,
"org_id": string,
"request_id": string | null,
"source": Database["public"]['Enums']["time_entry_source"],
"started_at": string,
"stop_reason": Database["public"]['Enums']["time_stop_reason"] | null,
"task_id": string,
"team_id": string,
"updated_at": string,
"user_id": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "time_entries"
        isOneToOne: false
        isSetofReturn: true
      } },
"decide_grant":
{ Args: { "p_approve": boolean,"p_grant": string,"p_note"?: string }; Returns: undefined
                           },
"delete_time_entry":
{ Args: { "p_entry": string,"p_expected_version": number }; Returns: undefined
                           },
"get_task_dependencies":
{ Args: { "p_task": string }; Returns: {
              "archived": boolean,"created_at": string,"direction": string,"issue_key": string,"link_id": string,"resolved": boolean,"status_category": Database["public"]['Enums']["status_category"],"status_label": string,"task_id": string,"team_name": string,"team_slug": string,"title": string,"visible": boolean
            }[]
                           },
"issue_grant":
{ Args: { "p_expires_at"?: string,"p_grantee": string,"p_reason": string,"p_scope": Database["public"]['Enums']["grant_scope"],"p_team": string }; Returns: string
                           },
"link_idea_to_request":
{ Args: { "p_idea": string,"p_request": string }; Returns: undefined
                           },
"link_request_task":
{ Args: { "p_request": string,"p_task": string }; Returns: undefined
                           },
"list_intake_teams":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string,"slug": string
            }[]
                           },
"move_task":
{ Args: { "p_after"?: string,"p_before"?: string,"p_expected_version": number,"p_status": string,"p_task": string }; Returns: {
              "id": string,"rank": number,"status_id": string,"version": number
            }[]
                           },
"peek_invitation":
{ Args: { "p_token_hash": string }; Returns: {
              "email": string,"state": string,"workspace_name": string
            }[]
                           },
"promote_idea_to_task":
{ Args: { "p_idea": string }; Returns: string
                           },
"publish_request_update":
{ Args: { "p_request": string,"p_summary": string }; Returns: undefined
                           },
"remove_task_dependency":
{ Args: { "p_link": string }; Returns: undefined
                           },
"revoke_grant":
{ Args: { "p_grant": string,"p_reason"?: string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "p_invitation": string }; Returns: undefined
                           },
"search_workspace":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "id": string,"kind": string,"ref": string,"team_name": string,"team_slug": string,"title": string
            }[]
                           },
"start_timer":
{ Args: { "p_task": string }; Returns: {
              "corrected_at": string | null,
"created_at": string,
"deleted_at": string | null,
"duration_seconds": number | null,
"ended_at": string | null,
"id": string,
"note": string | null,
"org_id": string,
"request_id": string | null,
"source": Database["public"]['Enums']["time_entry_source"],
"started_at": string,
"stop_reason": Database["public"]['Enums']["time_stop_reason"] | null,
"task_id": string,
"team_id": string,
"updated_at": string,
"user_id": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "time_entries"
        isOneToOne: false
        isSetofReturn: true
      } },
"stop_timer":
{ Args: { "p_entry"?: string }; Returns: {
              "corrected_at": string | null,
"created_at": string,
"deleted_at": string | null,
"duration_seconds": number | null,
"ended_at": string | null,
"id": string,
"note": string | null,
"org_id": string,
"request_id": string | null,
"source": Database["public"]['Enums']["time_entry_source"],
"started_at": string,
"stop_reason": Database["public"]['Enums']["time_stop_reason"] | null,
"task_id": string,
"team_id": string,
"updated_at": string,
"user_id": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "time_entries"
        isOneToOne: false
        isSetofReturn: true
      } },
"submit_draft_request":
{ Args: { "p_request": string }; Returns: undefined
                           },
"submit_work_request":
{ Args: { "p_acceptance_criteria"?: string,"p_as_draft": boolean,"p_audience"?: (string)[],"p_client_key": string,"p_links"?: string,"p_outcome": string,"p_problem": string,"p_requested_date"?: string,"p_requested_priority": Database["public"]['Enums']["task_priority"],"p_source_team"?: string,"p_target_team": string,"p_title": string }; Returns: string
                           },
"task_blocker_counts":
{ Args: { "p_tasks": (string)[] }; Returns: {
              "open_blockers": number,"task_id": string
            }[]
                           },
"team_dashboard_summary":
{ Args: { "p_team": string }; Returns: Json
                           },
"team_time_totals":
{ Args: { "p_from": string,"p_team": string,"p_to": string }; Returns: Json
                           },
"transition_work_request":
{ Args: { "p_committed_date"?: string,"p_committed_priority"?: Database["public"]['Enums']["task_priority"],"p_expected": Database["public"]['Enums']["request_status"],"p_public_summary"?: string,"p_reason"?: string,"p_request": string,"p_to": Database["public"]['Enums']["request_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "grant_scope": "dashboard_summary"|"workspace_read"|"collaboration"|"edit","grant_status": "pending"|"active"|"rejected"|"revoked","idea_state": "captured"|"reviewing"|"promoted"|"archived","library_kind": "doc"|"link"|"image"|"tool","member_state": "active"|"suspended","org_role": "owner"|"admin"|"member","project_health": "on_track"|"at_risk"|"off_track","project_status": "planned"|"active"|"paused"|"completed","request_status": "draft"|"submitted"|"in_triage"|"needs_info"|"accepted"|"in_progress"|"delivered"|"closed"|"declined","status_category": "backlog"|"unstarted"|"started"|"completed"|"canceled","task_priority": "none"|"low"|"medium"|"high"|"urgent","task_type": "task"|"bug"|"feature"|"chore"|"research"|"documentation","team_role": "lead"|"member","theme_pref": "system"|"light"|"dark","time_entry_source": "timer"|"manual","time_stop_reason": "user"|"switched"|"access_lost"|"suspended"|"task_archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "grant_scope": ["dashboard_summary", "workspace_read", "collaboration", "edit"],"grant_status": ["pending", "active", "rejected", "revoked"],"idea_state": ["captured", "reviewing", "promoted", "archived"],"library_kind": ["doc", "link", "image", "tool"],"member_state": ["active", "suspended"],"org_role": ["owner", "admin", "member"],"project_health": ["on_track", "at_risk", "off_track"],"project_status": ["planned", "active", "paused", "completed"],"request_status": ["draft", "submitted", "in_triage", "needs_info", "accepted", "in_progress", "delivered", "closed", "declined"],"status_category": ["backlog", "unstarted", "started", "completed", "canceled"],"task_priority": ["none", "low", "medium", "high", "urgent"],"task_type": ["task", "bug", "feature", "chore", "research", "documentation"],"team_role": ["lead", "member"],"theme_pref": ["system", "light", "dark"],"time_entry_source": ["timer", "manual"],"time_stop_reason": ["user", "switched", "access_lost", "suspended", "task_archived"]
          }
        }
} as const
