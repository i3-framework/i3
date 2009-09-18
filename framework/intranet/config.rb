#
# File: framework/intranet/config
#
# Provides the <I3::Configuration> class.
# 
# This file contains classes that load the configuration parameters of the
# server: what tools exist, what data services are available, and so on.
# These are available to servlets via the <I3.config> property.
#
# The server.yml file in i3-local/config provides the intranet's name,
# (e.g. "Company Intranet"), the name of the organization that is running
# the intranet, the theme to be used, and the defaults for user home pages.
#
# The database.yml file in i3-local/config provides the list of data
# services, which are then exposed via `I3.config.data_services`.
# Each data service is a `Hash` that normally contains the following keys:
#
#   "adapter"  - the database adapter to use, e.g. "mysql"
#   "host"     - the server to connect to
#   "database" - the default database (aka catalog) to use
#   "username" - the name of the user to connect as
#   "password" - the password for the user
#
# Note that although these keys usually exist, some data services may
# have other keys that they need, such as when ODBC is being used.
# See database.yml for the available data services and which keys
# exist for each data service.
#
# Each tool in the intranet has an info.yml file in its meta folder.
# This is used to generate an <I3::Tool> object for each tool, and
# the `I3.config.tools` property provides a list of these objects.
# See <I3::Tool> for more information on tool objects.
#
# Some intranet tools send and receive e-mail.  The mail.yml file in
# i3-local/config contains the settings for the host and account to use
# for mail services.  The settings from this file are provided via the
# `I3.config.mail_services` property.
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
#   $Id: config.rb 18 2007-12-11 23:22:49Z melfstrand $
#

require "yaml"

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3

  #
  # Class: I3::Configuration
  #
  # Provides access to the configuration of the intranet.
  # This includes the <title>, the <copyright> text, the list of
  # available <tools>, and the list of <data_services>.
  #
  # Use <I3.config> to get the shared instance of this class.
  #
  class Configuration

    DEFAULT_THEME = "default"
    DEFAULT_LOG_LEVEL = :debug

    # Property: title
    # The title of this intranet.
    attr_reader :title

    # Property: organization
    # The organization to which the intranet belongs.
    attr_reader :organization

    # Property: copyright
    # The copyright string to display for the intranet.
    attr_reader :copyright
    
    # Property: theme
    # The visual theme to use for the intranet.
    attr_reader :theme
    
    # Property: required_navbar_items
    # The set of navigation bar items that cannot be changed.
    # See <common/data/user-info>.
    attr_reader :required_navbar_items
    
    # Property: default_navbar_items
    # The default set of customizable navigation bar items for new users.
    # See <common/data/user-info>.
    attr_reader :default_navbar_items
    
    # Property: log_level
    # The level of detail to write to the log file.
    attr_reader :log_level
    
    # Property: tools
    # The list of available tools.  See <I3::ToolList>.
    attr_reader :tools
    
    # Property: data_services
    # The list of available data services.  See <I3::DataServiceList>.
    attr_reader :data_services

    # Property: directory_settings
    # The settings to use for the directory service provider.
    # See <framework/intranet/directory>.
    attr_reader :directory_settings
    
    # Property: mail_settings
    # The settings to use for mail services.
    # See <framework/i3-mailer>.
    attr_reader :mail_settings
    
    # Property: developer_settings
    # The special developer settings to override behavior
    attr_reader :developer_settings
    
    #
    # Private Constructor: I3::Configuration.new
    #
    # Loads the server configuration.  Use <I3.config> to get the shared
    # instance of this class instead of creating your own instance.
    #
    def initialize
      
      # Load server info file.
      info = load_settings_from_all_domains("server.yml")
      if info.empty?
        raise "Could not load server.yml.  Server not configured."
      end #if
      
      # Build configuration values.
      @title = info["title"]
      @organization = info["organization"]
      @copyright = "Copyright %d %s" % [Time.now.year, @organization]
      @theme = info["theme"] || DEFAULT_THEME
      @required_navbar_items = [{ "tool" => 'home', "path" => '/#/', "caption" => 'Home' }]
      @default_navbar_items = []
      unless info["navbar_items"].nil?
        @required_navbar_items += info["navbar_items"]["required"].to_a
        @default_navbar_items += info["navbar_items"]["default"].to_a
      end #unless
      @log_level = log_level_to_sym(info["log_level"])

      # Load additional configuration files.
      @directory_settings = load_settings_from_all_domains("directory.yml").symbolize_keys
      @mail_settings = SharedObject.convert_hashes(load_settings_from_all_domains("mail.yml"))
      @developer_settings = load_settings_from_all_domains("developer.yml").symbolize_keys rescue {}
      
      # Set up lists of tools and data services.
      @tools = ToolList.new
      @data_services = DataServiceList.new

    end #def
    
    private

    #
    # Private Method: load_settings_from_all_domains
    # 
    # Looks in the "config" folders of both the site and local domains
    # for a given YAML file and merges the settings from all files that
    # are found.  Local settings override site settings.
    # 
    def load_settings_from_all_domains(file_name)
      settings = {}
      if File.exists?("#{I3::SITE_PATH}/config/#{file_name}")
        settings.merge!(YAML.load(File.new("#{I3::SITE_PATH}/config/#{file_name}")))
      end #if
      if File.exists?("#{I3::LOCAL_PATH}/config/#{file_name}")
        settings.merge!(YAML.load(File.new("#{I3::LOCAL_PATH}/config/#{file_name}")))
      end #if
      settings
    end #def
    
    #
    # Private Method: log_level_to_sym
    # 
    # Validates the log level and provides a default (`:debug`) if
    # it is not valid.
    # 
    # Parameters:
    #   log_level - the level setting to validate
    # 
    # Returns:
    #   A symbol to use for the log level.
    # 
    def log_level_to_sym(log_level)
      if [ "fatal", "error", "warn", "info" ].include? log_level.to_s.downcase
        return log_level.to_sym
      else
        return :debug
      end #if
    end #def
    
  end #class Configuration


  #
  # Class: I3::DataServiceList
  #
  # List of available data services.  You can obtain the list by
  # calling `I3.config.data_services`.
  #
  # This acts like a `Hash`, but loads the list of data services the
  # first time it is accessed.  A re-load of the data service list can
  # be forced by passing `true` to the `load_config` method.
  #
  class DataServiceList
    include Enumerable
  
    # Constant: CONFIG_PATH
    # Name of the data service YAML file.
    CONFIG_FILE_NAME = "database.yml"

    #
    # Method: []
    #
    # Looks up a specific data service definition.
    #
    # Parameters:
    #   key - the key of the service to look up, as defined in the
    #     database.yml file
    #
    # Returns:
    #   A `Hash` containing the configuration of the requested service.
    #
    def [](key)
      load_config
      @services[key]
    end #def
    
    #
    # Method: each
    #
    # Calls the given block once for each key in the service list, passing
    # the key and the associated `Hash` to the block as a two-element array.
    # Because of the assignment semantics of block parameters, these
    # elements will be split out if the block has two formal parameters.
    #
    # Example:
    # (start example)
    #   I3.config.data_services.each do |key, service|
    #     puts 'The "%s" service uses the "%s" adapter.' %
    #          [key, service["adapter"]]
    #   end #each
    # (end example)
    #
    def each
      load_config
      @services.each { |pair| yield pair }
    end #def

    #
    # Property: default
    # 
    # The default data service for the intranet.  Read-only.
    # 
    def default
      return self["i3"]
    end

    #
    # Method: load_config
    #
    # Loads the service definitions from the local machine's database.yml
    # file.  This is called automatically the first time a data service is
    # requested through one of the other methods.
    #
    # Setting `force_load` to `true` causes the list of services to be
    # refreshed even if they have already been loaded.
    #
    def load_config(force_load=false)
      if @services.nil? or force_load
        config = {}
        if File.exists?("#{I3::SITE_PATH}/config/#{CONFIG_FILE_NAME}")
          config.merge!(YAML.load(File.new("#{I3::SITE_PATH}/config/#{CONFIG_FILE_NAME}")))
        end #if
        if File.exists?("#{I3::LOCAL_PATH}/config/#{CONFIG_FILE_NAME}")
          config.merge!(YAML.load(File.new("#{I3::LOCAL_PATH}/config/#{CONFIG_FILE_NAME}")))
        end #if
        if config.empty?
          raise "Could not load #{CONFIG_FILE_NAME}.  Data services not configured."
        end #if
        defaults = config["defaults"]
        @services = config["services"]
        @services.each do | service_id, service |
          defaults.each do | default_key, default_value |
            if service.has_key?(default_key) and service[default_key].nil?
              service[default_key] = default_value
            end #unless
          end #each
        end #each
      end #if
    end #def

  end #class DataServiceList


  #
  # Class: I3::ToolList
  #
  # List of available tools.  You can obtain the list by calling
  # `I3.config.tools`.
  #
  # This acts like a `Hash`, but loads the list of tools the first time it
  # is accessed.  A re-load of the tool list can be forced by passing `true`
  # to the `load_list` method.
  #
  class ToolList
    include Enumerable
    
    #
    # Method: []
    #
    # Looks up a specific tool object.
    #
    # Parameters:
    #   key - the short name of the tool to look up,
    #     i.e. the name of the tool's folder
    #
    # Returns:
    #   An <I3::Tool> instance containing information about the tool.
    #
    def [](key)
      load_list
      @tools[key]
    end #def

    #
    # Method: each
    #
    # Calls the given block once for each key in the tool list, passing
    # the key and the associated <I3::Tool> object to the block as a
    # two-element array.  Because of the assignment semantics of block
    # parameters, these elements will be split out if the block has two
    # formal parameters.
    #
    # Example:
    # (start example)
    #   I3.config.tools.each do |key, tool|
    #     puts 'The full name of the "%s" tool is "%s".' %
    #          [key, tool.name]
    #   end #each
    # (end example)
    #
    def each
      load_list
      @tools.each { |pair| yield pair }
    end #def

    #
    # Property: current
    # 
    # The <I3::Tool> object for the web service currently in use.
    # This is `nil` if the intranet is not currently responding to
    # a CGI request.  Read-only.
    #
    def current
      return @current unless @current.nil?
      return nil if I3.server.nil?
      request_uri = CGI.unescape(I3.server.request.params["REQUEST_URI"])
      return self[request_uri.scan(%r'/([^/]+)/data/')[0][0]]
    end #def
    # For internal use only.
    def current=(value)
      @current = value
    end #def

    #
    # Method: load_list
    #
    # Loads the tool information from each tool's info.yml file.
    # This is called automatically the first time a tool is requested
    # through one of the other methods.
    #
    # Setting `force_load` to `true` causes the list of tools to be
    # refreshed even if they have already been loaded.
    #
    def load_list(force_load=false)
      if @tools.nil? or force_load
        # Create Tool objects for the directories with info files.
        @tools = Hash.new
        Dir["#{I3::ROOT_PATH}/tools/*"].each do |d|
          @tools[File.basename(d)] = Tool.new(d) if File.directory?(d)
        end #each
        if File.directory?("#{I3::SITE_PATH}/tools")
          Dir["#{I3::SITE_PATH}/tools/*"].each do |d|
            @tools[File.basename(d)] = Tool.new(d) if File.directory?(d)
          end #each
        end #if
      end #if
    end #def

    #
    # Method: to_hash
    #
    # Returns a `Hash` containing a key/value pair for each tool in
    # the list.
    #
    def to_hash
      load_list
      @tools.inject(Hash.new) { |h, kv| k, v = kv; h[k] = v; h }
    end #def

    #
    # Method: to_json
    #
    # Encodes the tool list in JSON format for sending to the client.
    #
    def to_json(options = nil)
      self.to_hash.to_json(options)
    end #def

    #
    # Method: to_yaml
    #
    # Encodes the tool list as a `Hash` in YAML format.
    #
    # Parameters:
    #   opts - optional; additional options to pass to the YAML emitter
    #
    def to_yaml(*opts)
      self.to_hash.to_yaml(*opts)
    end #def

  end #class ToolList


  #
  # Class: I3::Tool
  #
  # Provides metadata for each i3 tool.
  #
  # Each tool has properties for its directory (`dir`), its `name`, its
  # `description`, its available `servlets` (the classes that respond to
  # requests), and its available `applets` (the HTML files in the tool's
  # "html" folders).  The `applets` hash maps client types (e.g. "client-web")
  # to arrays of <I3::Applet> objects.
  #
  class Tool
    include LoggingSupport
    
    attr_reader :dir,
                :name,
                :description,
                :database,
                :data_service,
                :settings,
                :applets
    
    attr_bool_reader :is_native, :has_info, :has_jobs, :is_searchable
    
    #
    # Constructor: new
    #
    # Returns a new <I3::Tool> instance loaded with data from the tool
    # directory.
    #
    # Parameters:
    #   tool_dir - the full path to the tool's directory
    #
    def initialize(tool_dir)
      @local_path = tool_dir
      @dir = File.basename(tool_dir)
      @has_info = File.exist?(tool_dir + "/meta/info.yml")
      @has_jobs = File.exist?(tool_dir + "/meta/jobs.rb")
      @is_searchable = File.exist?(tool_dir + "/meta/search.rb")
      if @has_info
        info = YAML.load(File.new(tool_dir + "/meta/info.yml"))
      else
        info = { "name" => @dir.titlecase }
      end #if
      @name = info["name"]
      @description = info["description"]
      @database = info["database"]
      @data_service = I3.config.data_services[info["data_service"]]
      settings = {}
      if File.exists?("#{I3::SITE_PATH}/config/tools/#{@dir}.yml")
        settings.merge!(YAML.load(File.new("#{I3::SITE_PATH}/config/tools/#{@dir}.yml")))
      end #if
      if File.exists?("#{I3::LOCAL_PATH}/config/tools/#{@dir}.yml")
        settings.merge!(YAML.load(File.new("#{I3::LOCAL_PATH}/config/tools/#{@dir}.yml")))
      end #if
      @settings = I3::SharedObject.convert_hashes(settings)
      @applets = {}
      @is_native = false
      Dir[tool_dir + "/client-*/html/*.html"].each do |html_file|
        @is_native = true
        client_type, applet_name = html_file.match(%r'/(client-[^/]+)/html/([^.]+)\.html$')[1..2]
        @applets[client_type] = {} if @applets[client_type].nil?
        @applets[client_type][applet_name] = Applet.new(html_file)
      end #each
    end #def
    
    #
    # Method: servlets
    #
    # Provides a `Hash` that maps servlet names (e.g. "summary") to
    # Ruby classes (e.g. `SummaryServlet`).  The list is cached the
    # first time it is requested.
    #
    def servlets
      if @servlets.nil?
        @servlets = Hash.new
        Dir["#{@local_path}/data/*.rb"].each do |servlet_file|
          require servlet_file
          @servlets[File.basename(servlet_file, ".rb")] = I3::Servlet.last_servlet_loaded
        end #case
      end #if
      @servlets
    end #def
    
    #
    # Method: to_shared
    #
    # Returns the tool metadata as an `I3::SharedObject`, omitting
    # server-only attributes (e.g. `servlets`, `database`) and
    # removing punctuation from method names.
    #
    def to_shared
      # Start with common fields.
      so = I3::SharedObject.new(
        :dir => self.dir,
        :name => self.name,
        :description => self.description,
        :is_native => self.is_native?
      )
      # Add applet key-value pairs.
      so[:applets] = {}
      self.applets.each do |kind, list|
        so[:applets][kind] = {}
        list.each { |name, applet| so[:applets][kind][name] = applet.to_shared }
      end #each
      # Only add these fields if they're applicable.
      so.is_searchable = true if self.is_searchable?
      so
    end #def
    
  end #class Tool


  #
  # Class: I3::Applet
  #
  # Provides information about a single HTML applet in a tool.
  #
  # Each applet has a <local_path> that provides its full path on the filesystem,
  # a <remote_path> that can be requested by the client, a <name> that is used
  # in virtual paths on the client (e.g. "index"), and a <last_modified_at> time
  # that gives the most recent modification time of the HTML file or any of its
  # dependencies.
  # 
  # The last property, `last_modified_at`, is especially important, as the
  # intranet server will use this to determine whether the client has out-of-date
  # files.  If the client requests an HTML file with a timestamp that corresponds
  # with the last-modified time of the actual HTML file, but one of the file's
  # dependencies has been modified, the client may end up caching out-of-date data.
  # To prevent this, the required timestamp for the HTML file is set to that of
  # the most recently modified dependency (including the HTML file itself), so
  # that the client must request a new HTML file with updated CSS and JavaScript
  # links whenever a dependency changes.
  #
  class Applet
    attr_reader :local_path, :remote_path, :name, :last_modified_at

    #
    # Constructor: new
    # 
    # Returns a new <I3::Applet> instance.
    # 
    # Parameters:
    #   path - the full path of the HTML file on the local filesystem
    # 
    def initialize(path)
      @local_path = path
      @name = File.basename(path, ".html")
      @last_modified_at = File.mtime(path)
      self.dependencies.each do |dependency_path|
        dependency_mtime = File.mtime(dependency_path)
        @last_modified_at = dependency_mtime if dependency_mtime > @last_modified_at
      end #each
      @remote_path = "/" + path.match(%r'/([^/]+/client-[^/]+/html/[^.]+\.html)$')[1] + "/" +
                     @last_modified_at.to_i.to_s(16)
    end #def

    #
    # Method: dependencies
    # 
    # Provides a list of the CSS and JavaScript files upon which this applet
    # is dependent.
    # 
    # Returns:
    #   An array of strings, each of which is the full path to a file.
    # 
    def dependencies
      list = []
      File.open(@local_path) do |file|
        file.each_line do |line|
          case line
            when %r' href="([^"]+\.css)"' ; list << I3.resource($1)
            when %r' src="([^"]+\.js)"' ; list << I3.resource($1)
          end #case
        end #each_line
      end #open
      list.find_all { |path| File.exist?(path) }
    end #def
    
    #
    # Method: to_shared
    #
    # Returns the applet attributes as an `I3::SharedObject`, omitting
    # server-only attributes (e.g. `local_path`).
    #
    def to_shared
      I3::SharedObject.new(
        :name => self.name,
        :last_modified_at => self.last_modified_at
      )
    end #def
    
  end #class


  #
  # Property: I3.config
  #
  # The shared instance of the intranet configuration (<I3::Configuration>).
  #
  def self.config
    @_config = Configuration.new if @_config.nil?
    @_config
  end #def

end #module
