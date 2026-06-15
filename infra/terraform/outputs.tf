output "hostname" {
  description = "Production hostname protected by Cloudflare Access."
  value       = local.app_hostname
}

output "d1_database_id" {
  description = "D1 database ID. Keep wrangler.jsonc aligned with this value."
  value       = cloudflare_d1_database.tilelog_lens.id
}

output "access_application_id" {
  description = "Cloudflare Access application ID."
  value       = cloudflare_zero_trust_access_application.tilelog_lens.id
}

output "access_application_aud" {
  description = "Cloudflare Access audience tag. Store this as the Worker ACCESS_AUD secret."
  value       = cloudflare_zero_trust_access_application.tilelog_lens.aud
  sensitive   = true
}

output "dns_record_id" {
  description = "DNS record ID for the production hostname."
  value       = cloudflare_record.tilelog_lens.id
}
