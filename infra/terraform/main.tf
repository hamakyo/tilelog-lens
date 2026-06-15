locals {
  app_hostname = "${var.app_subdomain}.${var.zone_name}"
}

resource "cloudflare_d1_database" "tilelog_lens" {
  account_id = var.cloudflare_account_id
  name       = var.d1_database_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_record" "tilelog_lens" {
  zone_id = var.cloudflare_zone_id
  name    = var.app_subdomain
  type    = var.dns_record_type
  value   = var.dns_record_content
  proxied = true
  ttl     = 1
  comment = "TileLog Lens Worker hostname. Worker code and route are deployed by Wrangler."
}

resource "cloudflare_zero_trust_access_application" "tilelog_lens" {
  zone_id                   = var.cloudflare_zone_id
  name                      = var.access_application_name
  domain                    = local.app_hostname
  type                      = "self_hosted"
  session_duration          = var.access_session_duration
  auto_redirect_to_identity = false
}

resource "cloudflare_zero_trust_access_policy" "owner" {
  zone_id        = var.cloudflare_zone_id
  application_id = cloudflare_zero_trust_access_application.tilelog_lens.id
  name           = "Allow owner email"
  precedence     = 1
  decision       = "allow"

  include {
    email = [var.owner_email]
  }
}
