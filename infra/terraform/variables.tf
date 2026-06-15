variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Worker, D1 database, and Access configuration."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the production hostname."
  type        = string
}

variable "zone_name" {
  description = "Production DNS zone name."
  type        = string
  default     = "hamakyo.dev"
}

variable "app_subdomain" {
  description = "Subdomain used by the production Worker route."
  type        = string
  default     = "tilelog-lens"
}

variable "owner_email" {
  description = "Only this email address is allowed through Cloudflare Access."
  type        = string
  sensitive   = true
}

variable "d1_database_name" {
  description = "Cloudflare D1 database name used by the Worker DB binding."
  type        = string
  default     = "tilelog_lens"
}

variable "access_application_name" {
  description = "Cloudflare Access application display name."
  type        = string
  default     = "TileLog Lens"
}

variable "access_session_duration" {
  description = "Cloudflare Access session duration."
  type        = string
  default     = "24h"
}

variable "dns_record_type" {
  description = "DNS record type for the proxied Worker hostname placeholder."
  type        = string
  default     = "AAAA"

  validation {
    condition     = contains(["A", "AAAA", "CNAME"], var.dns_record_type)
    error_message = "dns_record_type must be A, AAAA, or CNAME."
  }
}

variable "dns_record_content" {
  description = "DNS record content for the proxied hostname. Use 100:: for proxied AAAA placeholders, or import the existing record."
  type        = string
  default     = "100::"
}
