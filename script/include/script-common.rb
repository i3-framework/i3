#
# Helper Script: script-common
#
# Includes files and defines values common to setup scripts.  This makes
# writing the scripts a bit easier.
#

require "fileutils"

# Load common intranet files.
require File.expand_path(File.dirname(__FILE__) + "/../../framework/intranet")
require "i3-template"

# A database connection is required for many intranet operations.
I3::Record.establish_connection I3.config.data_services["i3"]

# Extensions to the I3 module for script use only.
module I3

  # Attempts to determine the user's full name and e-mail address
  def self.get_user_credit
    short_name = case RUBY_PLATFORM
      when /mswin32/ then ENV["USERNAME"].to_s
      else ENV["USER"].to_s
    end #case
    if RUBY_PLATFORM =~ /darwin/ and `which dscl`[0..0] == "/"
      # Mac OS X.  Try to find the full name in directory services.
      full_name = `dscl localhost -read /Search/Users/#{short_name} RealName`
      full_name = full_name.split(":")[1].strip if full_name.starts_with? "RealName:"
    end #if
    full_name = short_name if full_name.to_s.empty?
    return "#{full_name}"
  end #def
  
  # Paths to templates that are used to generate intranet files.
  TEMPLATE_PATH = I3::ROOT_PATH + "/script/templates"
  TEMPLATE_PATH_SITE = I3::SITE_PATH + "/script/templates"

  # Path to third-party libraries for script use.
  LIB_PATH = I3::ROOT_PATH + "/script/lib"
  LIB_PATH_SITE = I3::SITE_PATH + "/script/lib"
  
  # User name and e-mail address to be generated in sample source files.
  CREDIT_STRING = self.get_user_credit
  
  # Copyright string to be generated in sample source files.
  COPYRIGHT_STRING = "Copyright #{Time.now.year} #{I3.config.organization}"

  # Version string to be generated in sample source files.
  VERSION_STRING = "$I" + "d$"  # Split here so Subversion doesn't expand it
  
end #module
