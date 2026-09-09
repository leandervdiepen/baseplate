terraform {
  required_version = ">= 1.5.0"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.68"
    }
  }
}

provider "hcloud" {}

variable "stack_name" { type = string }
variable "hostname" { type = string }
variable "location" { type = string }
variable "ssh_key_name" { type = string }
variable "dns_zone" { type = string }

data "hcloud_ssh_key" "operator" {
  name = var.ssh_key_name
}

data "hcloud_zone" "zone" {
  name = var.dns_zone
}

resource "hcloud_firewall" "stack" {
  name = "${var.stack_name}-fw"
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "stack" {
  name         = var.stack_name
  server_type  = "cx23"
  image        = "ubuntu-24.04"
  location     = var.location
  ssh_keys     = [data.hcloud_ssh_key.operator.id]
  firewall_ids = [hcloud_firewall.stack.id]
  user_data    = file("${path.module}/cloud-init.yaml")
}

# Hetzner DNS names the zone's own record "@". Trimming the suffix off a
# hostname that IS the zone leaves the zone, which would have created
# example.com.example.com instead of the apex record the operator asked for.
resource "hcloud_zone_rrset" "api" {
  zone = data.hcloud_zone.zone.name
  name = var.hostname == var.dns_zone ? "@" : trimsuffix(var.hostname, ".${var.dns_zone}")
  type = "A"
  records = [
    { value = hcloud_server.stack.ipv4_address }
  ]
  ttl = 60
}

# The server gets IPv6 whether or not anything points at it, and a client on an
# IPv6-only network resolves AAAA first.
resource "hcloud_zone_rrset" "api_v6" {
  zone = data.hcloud_zone.zone.name
  name = var.hostname == var.dns_zone ? "@" : trimsuffix(var.hostname, ".${var.dns_zone}")
  type = "AAAA"
  records = [
    { value = hcloud_server.stack.ipv6_address }
  ]
  ttl = 60
}

output "server_id" { value = hcloud_server.stack.id }
output "ipv4" { value = hcloud_server.stack.ipv4_address }
