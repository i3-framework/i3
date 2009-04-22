#!/usr/bin/env ruby

#
# Helper Script: setup
#
# This script is run from the `i3/script` directory to create the "i3-local"
# directory two levels up (i.e. alongside the i3 directory) and populate it
# with the necessary files for running the i3 server.
#
# *Layout of i3-local*
# 
# (start layout)
#   i3-local/
#     bin/
#       pen                       - Binary for load balancing
#       verify-permission         - Binary for checking file permissions
#     config/
#       database.yml              - Data source configuration
#       directory.yml             - Directory service provider configuration
#       mail.yml                  - Mail service configuration
#       mongrel.yml               - Mongrel service configuration
#       server.yml                - Server configuration
#       apache2/
#         i3.conf                 - Server-specific Apache 2 configuration
#         i3-auth.conf            - Security settings and permissions
#         i3-common.conf          - Common Apache 2 configuration
#         i3-ssl.conf             - SSL settings (optional)
#         i3-vhost.conf           - A VirtualHost wrapper (optional)
#         i3-trac.conf            - Defines the Trac installs (optional)
#       tools/
#         home.yml                - Home Page tool configuration
#         documents.yml           - Documents tool configuration
#         bboard.yml              - Bulletin Board tool configuration
#     doc/
#       book/                     - Intranet 3 Programming book (HTML)
#       js/                       - JavaScript API documentation
#       ruby/                     - Ruby API documentation
#     files/
#       cache/                    - Intranet-managed cache files
#       documents/                - Files accessed by the Documents tool
#     logs/
#       access.log                - Apache log file for all requests
#       error.log                 - Apache log file for server errors
#       intranet.log              - Intranet web service log file
# (end layout)
#
# The `config/database.yml` file contains the data service definitions for
# the intranet.  It contains the host name, user name, password, and default
# database for each service.
#
# The `config/mongrel.yml` file contains the settings for the Mongrel service,
# which handles all of the requests for Ruby web services (.../data/...) and
# preprocessed static files (HTML, CSS, and JavaScript).  This is set up on a
# separate port from the web server, and only responds to connections from the
# web server itself.
#
# The `config/server.yml` file contains general settings for the server, such
# as the name of the intranet and the default navigation bar items.
#
# The files in `config/apache2` are used to configure the Apache 2 web server
# to support the intranet.  `i3.conf` is the main file that varies from system
# to system; it defines the paths for the i3 files.  `i3-common.conf` contains
# settings that are common to all i3 installations.  Finally, `i3-auth.conf`
# specifies the authentication/authorization handlers to use and defines the
# permissions for who can access the intranet.  The permissions may vary from
# system to system; for example, developers will probably want to limit access
# to their own installations.
#
# Credits:
# 
#   Written by Marshall Elfstrand (marshall@vengefulcow.com).
# 
# Copyright / License:
# 
#   Copyright 2009 Mission Aviation Fellowship
# 
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#
# Version:
#   $Id: setup.rb 69 2008-03-26 16:10:10Z nmellis $
#

require 'fileutils'

# Determine the path of the parent of the i3 directory.
I3_PARENT = File.expand_path(File.dirname(__FILE__) + "/../..")

# Define the path of the template files.
TEMPLATE_PATH = File.expand_path(File.dirname(__FILE__) + "/templates/setup")

# Define the path of the configuration files.
CONFIG_PATH = "#{I3_PARENT}/i3-local/config"
SITE_CONFIG_PATH = "#{I3_PARENT}/i3-site/config"

# Define default settings for user preferences.
DEFAULT_SERVER_PORT = "89"
DEFAULT_SERVER_PORT_SSL = "443"
DEFAULT_SSL_CERT = "/etc/certificates/Default.crt"
DEFAULT_SSL_KEY = "/etc/certificates/Default.key"

# Set up handler for Ctrl-C.
trap("INT") { puts "\n\n- Setup cancelled at user request.\n\n"; exit }


# ----------------------------------------------------------------------------
# Ask if we're using SSL.
#
puts <<EOS
------------------------------------------------------------------------------
Welcome to i3 Server Setup!
------------------------------------------------------------------------------

In order to configure i3 for your system, a couple of settings will be needed.

First, will you be using secure sockets layer (SSL) for this server?
You will need an SSL certificate file and SSL key file.
EOS
print "Enable SSL? (y/n) [n]: "
ssl_is_enabled = (gets.strip.downcase == "y")
if ssl_is_enabled
  default_port = DEFAULT_SERVER_PORT_SSL
  print "Path to SSL certificate file [#{DEFAULT_SSL_CERT}]: "
  ssl_cert_path = (gets.strip)
  ssl_cert_path = DEFAULT_SSL_CERT if ssl_cert_path.empty?
  print "Path to SSL key file [#{DEFAULT_SSL_KEY}]: "
  ssl_key_path = (gets.strip)
  ssl_key_path = DEFAULT_SSL_KEY if ssl_key_path.empty?
else
  default_port = DEFAULT_SERVER_PORT
  ssl_cert_path = DEFAULT_SSL_CERT
  ssl_key_path = DEFAULT_SSL_KEY
end #if


# ----------------------------------------------------------------------------
# Ask for the port number.
#
puts <<EOS

Next you will need to select a port for the server to run on.  For developer
systems, 89 is suggested.  For servers running SSL, 443 is the usual SSL port.
EOS
print "Port number for i3 web server? [#{default_port}]: "
server_port = (gets.strip.downcase)
server_port  = default_port if server_port.empty?


# ----------------------------------------------------------------------------
# Review the settings before beginning.
#
puts
puts "-" * 78
puts "Configuration options:"
puts "  Port number:         #{server_port}"
puts "  SSL enabled:         #{ssl_is_enabled}"
puts "  SSL certificate:     #{ssl_cert_path}" if ssl_is_enabled
puts "  SSL key:             #{ssl_key_path}" if ssl_is_enabled
puts "-" * 78
puts
response = ""
while response.empty?
  print "Is this correct? (y/n): "
  response = (gets.strip.downcase)
  response = "" unless ["y", "n"].include? response
end #while
puts
if response == "n"
  puts "- Setup cancelled at user request."
  puts
  exit
end #if


# ----------------------------------------------------------------------------
# Create the i3-local directories as necessary.
#
modifications_were_made = false
[ "#{I3_PARENT}/i3-local/bin",
  "#{I3_PARENT}/i3-local/config/apache2",
  "#{I3_PARENT}/i3-local/config/tools",
  "#{I3_PARENT}/i3-local/doc",
  "#{I3_PARENT}/i3-local/files/cache",
  "#{I3_PARENT}/i3-local/files/documents",
  "#{I3_PARENT}/i3-local/files/virtual-root",
  "#{I3_PARENT}/i3-local/logs"
].each do |dir|
  unless File.directory?(dir)
    FileUtils.mkdir_p(dir)
    modifications_were_made = true
  end #unless
end #each
puts "- Created directories in #{I3_PARENT}/i3-local" if modifications_were_made


# ----------------------------------------------------------------------------
# Detect site-specific folder and use paths if available.
#
auth_domain = File.exist?("#{SITE_CONFIG_PATH}/apache2/i3-auth.conf") ? "i3-site" : "i3-local"
common_domain = File.exist?("#{SITE_CONFIG_PATH}/apache2/i3-common.conf") ? "i3-site" : "i3-local"


# ----------------------------------------------------------------------------
# Create the server-specific Apache 2 configuration file in config/apache2.
#
ssl_comment = ssl_is_enabled ? '' : '#'
if File.exists?("#{CONFIG_PATH}/apache2/i3.conf")
  puts "- File already exists: #{CONFIG_PATH}/apache2/i3.conf"
else
  File.open("#{CONFIG_PATH}/apache2/i3.conf", "w") do |outfile|
    File.readlines("#{TEMPLATE_PATH}/apache2/i3.conf").each do |line|
      line.sub!("{{I3_SERVER}}", I3_PARENT)
      line.sub!("{{I3_SERVER_PORT}}", server_port)
      line.sub!("{{SSL_COMMENT}}", ssl_comment)
      line.sub!("{{AUTH_DOMAIN}}", auth_domain)
      line.sub!("{{COMMON_DOMAIN}}", common_domain)
      outfile.print line
    end #each
  end #open
  puts "- Created file: #{CONFIG_PATH}/apache2/i3.conf"
  modifications_were_made = true
end #if


# ----------------------------------------------------------------------------
# Copy the common Apache 2 configuration files into config/apache2.
#
["i3-auth", "i3-common"].each do |template|
  if File.exists?("#{CONFIG_PATH}/apache2/#{template}.conf")
    puts "- File already exists: #{CONFIG_PATH}/apache2/#{template}.conf"
  elsif File.exists?("#{SITE_CONFIG_PATH}/apache2/#{template}.conf")
    puts "- Using i3-site: #{SITE_CONFIG_PATH}/apache2/#{template}.conf"
  else
    File.open("#{CONFIG_PATH}/apache2/#{template}.conf", "w") do |outfile|
      File.readlines("#{TEMPLATE_PATH}/apache2/#{template}.conf").each do |line|
        outfile.print line
      end #each
    end #open
    puts "- Created file: #{CONFIG_PATH}/apache2/#{template}.conf"
    modifications_were_made = true
  end #if
end #each


if ssl_is_enabled
  
  # --------------------------------------------------------------------------
  # Create the Apache 2 SSL configuration file in config/apache2.
  #
  if File.exists?("#{CONFIG_PATH}/apache2/i3-ssl.conf")
    puts "- File already exists: #{CONFIG_PATH}/apache2/i3-ssl.conf"
  else
    File.open("#{CONFIG_PATH}/apache2/i3-ssl.conf", "w") do |outfile|
      File.readlines("#{TEMPLATE_PATH}/apache2/i3-ssl.conf").each do |line|
        line.sub!("{{I3_SERVER}}", I3_PARENT)
        line.sub!("{{SSL_CERT}}", ssl_cert_path)
        line.sub!("{{SSL_KEY}}", ssl_key_path)
        outfile.print line
      end #each
    end #open
    puts "- Created file: #{CONFIG_PATH}/apache2/i3-ssl.conf"
    modifications_were_made = true
  end #if
  
end #if ssl_is_enabled


# ----------------------------------------------------------------------------
# Copy the common YAML files into the config directory.
#
["database", "directory", "mail", "mongrel", "server", "tools/home", "tools/documents", 
 "tools/bboard"].each do |t|
  if File.exists?("#{CONFIG_PATH}/#{t}.yml")
    puts "- File already exists: #{CONFIG_PATH}/#{t}.yml"
  elsif File.exists?("#{SITE_CONFIG_PATH}/#{t}.yml")
    puts "- Using i3-site: #{SITE_CONFIG_PATH}/#{t}.yml"
  else
    File.open("#{CONFIG_PATH}/#{t}.yml", "w") do |outfile|
      File.readlines("#{TEMPLATE_PATH}/#{t}.yml").each do |line|
        outfile.print line
      end #each
    end #open
    puts "- Created file: #{CONFIG_PATH}/#{t}.yml"
    modifications_were_made = true
  end #if
end #each


# ----------------------------------------------------------------------------
# Write out instructions for follow-up.
#
if modifications_were_made
  puts <<EOS
- Finished scripted portion of setup.

------------------------------------------------------------------------------

To enable the Intranet 3 server, you will need to do the following:

1) Edit the config/database.yml, config/directory.yml, and config/server.yml
   files in i3-local and adjust the settings to suit your setup.

2) Make sure that the "files" and "logs" folders (and their subfolders)
   in i3-local are writable by the web server.
   
3) Set script/server/i3-mongrel-service.rb to load at system startup.
   An example launchd file for Mac OS X is provided in the xtras folder.
   
4) If you plan on using the i3-load-balancer.rb script, place the "pen"
   binary (http://siag.nu/pen/) in i3-local/bin, and set i3-load-balancer.rb
   to load at system startup.  An example launchd file for Mac OS X is
   provided in the xtras folder.

5) If this is the same system that the database is running on (i.e. not
   a developer machine), set the script/server/i3-jobs.rb script to load
   at system startup.  An example launchd file for Mac OS X is provided
   in the xtras folder.

6) Add the following line to the end of your Apache 2 httpd.conf file:

     Include #{I3_PARENT}/i3-local/config/apache2/i3.conf

EOS
else
  puts <<EOS
- Finished scripted portion of setup.

------------------------------------------------------------------------------

No modifications were made to i3-local.

EOS
end #if

puts "-" * 78
puts
