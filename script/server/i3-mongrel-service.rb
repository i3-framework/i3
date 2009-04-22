#!/usr/bin/env ruby

#
# Helper Script: server/i3-mongrel-service
#
# Processes all intranet web service requests and some static file requests.
# This script should be set up to run at system startup.
#
# This script uses the Mongrel web server to respond to incoming requests
# using the HTTP protocol and forward them to the appropriate intranet
# handler.  HTML, JavaScript, and CSS file requests have handlers that
# perform some basic text compression on the files before sending them to
# the client, while web service requests are sent to the "servlet" mapped
# to the requested path.
#
# The server that this script starts will listen on a private port number,
# defined in `i3-local/config/mongrel.yml`.  Requests for paths that this
# service handles will be proxied to that port by Apache.  The port can be
# overridden by a "--port __n__" command line option, where __n__ is the
# port number to listen on.
# 
# A cluster of servers can be set up by using the "--cluster" command line
# option.  In this case, the port defined in the configuration file will
# be used as a base, and each member of the cluster will listen on a
# higher port number, starting from __base__ + 1.  For example, if the
# base port is 8000, and there are five members in the cluster, the members
# will listen on ports 8001, 8002, 8003, 8004, and 8005.
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
#   $Id: i3-mongrel-service.rb 23 2007-12-13 00:20:51Z melfstrand $
#

require "rubygems"

require "fileutils"                       # For setting the working directory
require "mongrel"                         # For running the server
require "yaml"                            # For reading configuration data


#
# Module: I3MongrelService
#
# The module containing the classes for the Mongrel-based server.
#
module I3MongrelService

  # The path of the i3 folder.
  I3_ROOT = File.expand_path(File.dirname(__FILE__) + "/../..")

  # The path of the i3-site folder.
  I3_SITE = File.expand_path(I3_ROOT + "/../i3-site")

  # The path of the i3-local folder.
  I3_LOCAL = File.expand_path(I3_ROOT + "/../i3-local")

  # The path of this script.
  SCRIPT_PATH = File.expand_path(__FILE__)


  #
  # Class: I3MongrelService::ServerStarter
  # 
  # Starts an individual instance of the Mongrel-based intranet service.
  # 
  class ServerStarter

    #
    # Class Method: new
    # 
    # Returns a new instance of the server starter.
    # 
    # Parameters:
    #   settings - the settings to be passed to the Mongrel `Configurator`.
    # 
    def initialize(settings)
      @settings = settings
    end #def

    #
    # Method: start
    # 
    # Sets up the Mongrel `Configurator` with handlers for the various types
    # of requests and starts listening for connections.
    # 
    # This method does not return until the server has been stopped by an
    # `INT` or `TERM` signal.
    # 
    def start
      I3::Record.establish_connection I3.config.data_services["i3"]
      handler_css = I3::CSSHandler.new
      handler_data = I3::WebServiceHandler.new
      handler_html = I3::HTMLHandler.new
      handler_js = I3::JavaScriptHandler.new
      gzip = I3::GzipFilter.new
      mongrel_config = Mongrel::Configurator.new(@settings) do
        listener do
          FileUtils.cd "#{I3_LOCAL}/files/virtual-root" do
            I3.config.tools.each do |tool_dir, tool|
              uri "/#{tool_dir}/data/", :handler => handler_data
              uri "/#{tool_dir}/data/", :handler => gzip
              Dir["#{tool_dir}/client-*"].each do |tool_client_dir|
                uri "/#{tool_client_dir}/css/",  :handler => handler_css
                uri "/#{tool_client_dir}/css/",  :handler => gzip
                uri "/#{tool_client_dir}/html/", :handler => handler_html
                uri "/#{tool_client_dir}/html/", :handler => gzip
                uri "/#{tool_client_dir}/js/",   :handler => handler_js
                uri "/#{tool_client_dir}/js/",   :handler => gzip
              end #each
            end #each
            Dir["_theme/client-*"].each do |theme_client_dir|
              theme_client_dir = File.basename(theme_client_dir)
              uri "/$theme/#{theme_client_dir}/css/",  :handler => handler_css
              uri "/$theme/#{theme_client_dir}/css/",  :handler => gzip
            end #each
          end #cd
        end #listener
        trap("INT")  { stop }
        trap("TERM") { stop }
        run
      end #new
      I3.log.info("I3MongrelService::ServerStarter") do
        "Started server listening on port #{@settings[:port]}"
      end #info
      mongrel_config.join
      I3.log.info("I3MongrelService::ServerStarter") do
        "Stopped server for port #{@settings[:port]}"
      end #info
    end #def

  end #class


  #
  # Class: I3MongrelService::Cluster
  # 
  # Manages a cluster of Mongrel-based intranet services.
  # 
  class Cluster
    
    # Number of seconds that each subprocess must live in order to be
    # eligible for restarting if/when it dies.  If a subprocess dies
    # before this amount of time, it is assumed that there is an error
    # in the intranet code, and the entire cluster will be shut down.
    REQUIRED_LIFE_SPAN_FOR_RESTART = 30

    #
    # Class Method: new
    # 
    # Returns a new instance of the cluster manager.
    # 
    # Parameters:
    #   settings - the settings to be passed to the Mongrel `Configurator`.
    #     See the file comments for how the `:port` setting is used.
    # 
    def initialize(settings)
      @settings = settings
      @host = settings[:host] || "127.0.0.1"
      @base_port = settings[:port] || 8000
      @size = settings[:cluster_size] || 5
      @death_mutex = Mutex.new
      @log_mutex = Mutex.new
      @cluster_members = {}
      trap("INT")  { stop }
      trap("TERM") { stop }
    end #def
    
    #
    # Method: start
    # 
    # Starts the members of the cluster.
    # 
    # This method does not return until the cluster has been stopped
    # by an `INT` or `TERM` signal.
    # 
    def start
      @should_keep_members_alive = true
      log_message "Starting #{@size} subprocesses..."
      @size.times { |i| start_cluster_member_on_port(@base_port + i + 1) }
      log_message "Cluster started."
      @life_thread = Thread.new { sleep }
      @life_thread.join
      log_message "Shutting down..."
      @should_keep_members_alive = false
      @cluster_members.each { |port, member| member.die! }
      log_message "Cluster stopped."
    end #def
    
    #
    # Method: start_cluster_member_on_port
    # 
    # Starts an individual <ClusterMember>.
    # 
    # This is called when the cluster first starts, and when a member
    # dies and is elegible for restarting.
    # 
    # Parameters:
    #   port - the port number on which the cluster member should listen
    # 
    def start_cluster_member_on_port(port)
      log_message "Starting subprocess listening on port #{port}."
      member_settings = @settings.merge(:port => port)
      @cluster_members[port] = ClusterMember.new(self, member_settings)
    end #def

    #
    # Method: stop
    # 
    # Stops all members of the cluster.
    # 
    def stop
      @life_thread.run unless @life_thread.nil?
    end #def
    
    #
    # Method: member_died
    # 
    # Called when a <ClusterMember> detects that its process has died.
    # If the cluster is not shutting down, and if the process has lived
    # long enough that it doesn't seem to be a serious issue, a new
    # member will be created in its place.
    # 
    def member_died(member)
      @death_mutex.synchronize do
        log_message "Suprocess listening on port #{member.port} has stopped."
        @cluster_members.delete(member.port)
        if @should_keep_members_alive
          if member.life_span < REQUIRED_LIFE_SPAN_FOR_RESTART
            log_message "Suprocess listening on port #{member.port} died too quickly!"
            stop
          else
            log_message "Restarting subprocess for port #{member.port}."
            start_cluster_member_on_port(member.port)
          end #if
        end #if
      end #synchronize
    end #def

    #
    # Method: log_message
    # 
    # Writes a message to standard error with a time stamp.
    # 
    def log_message(text)
      @log_mutex.synchronize do
        STDERR.puts "%s  %s: %s" % [ Time.now.strftime("%Y/%m/%d %H:%M:%S"), self.class.name, text ]
      end #synchronize
    end #def
    
  end #class


  #
  # Class: I3MongrelService::ClusterMember
  # 
  # Manages a single member of a cluster.
  # 
  # This keeps track of a cluster member's process ID, port number,
  # and start time, so that it can be tracked.
  # 
  class ClusterMember

    # Method: port
    # The port number on which the member is listening.
    attr_reader :port
    
    #
    # Class Method: new
    # 
    # Returns a new instance of the cluster member.
    # 
    # Parameters:
    #   cluster - the <Cluster> to which this member belongs
    #   settings - the settings to use for the member.  Currently only
    #     the `:port` setting is honored; other settings will be loaded
    #     from the configuration file by the subprocess.
    # 
    def initialize(cluster, settings)
      @cluster = cluster
      @port = settings[:port]
      @start_time = Time.now
      ios = IO.popen("ruby \"#{SCRIPT_PATH}\" --port #{@port}")
      @pid = ios.pid
      @thread = Thread.new do
        while not (line = ios.gets).nil?
          @cluster.log_message(line)
        end #while
        ios.close
        @end_time = Time.now
        @cluster.member_died(self)
      end #Thread.new
    end #def

    #
    # Method: die!
    # 
    # Kills the process for this cluster member.
    # 
    def die!
      begin
        Process.kill("INT", @pid)
        @thread.join
      rescue Exception
      end
    end #def

    #
    # Method: life_span
    # 
    # Returns the length of time (in seconds) that this member's process
    # has been running, or did run if it has died.
    def life_span
      end_time = @end_time.nil? ? Time.now : @end_time
      end_time - @start_time
    end

  end #class

  def self.prepare_server
    
    # Clear compression cache.
    if File.directory? "#{I3_LOCAL}/files/cache/common/compress"
      FileUtils.rm_r "#{I3_LOCAL}/files/cache/common/compress"
    end #if
    
    # Remove theme symlinks in virtual server root.
    if File.directory?("#{I3_LOCAL}/files/virtual-root/_theme")
      Dir["#{I3_LOCAL}/files/virtual-root/_theme/*"].each { |d| FileUtils.rm(d) }
    end #if
    
    # Remove tool symlinks in virtual server root.
    Dir["#{I3_LOCAL}/files/virtual-root/*"].each do |d|
      FileUtils.rm(d) unless File.basename(d) == "_theme"
    end #each
    
    # Build theme symlinks in virtual server root.
    links = {}
    [ "#{I3_ROOT}/themes/default", "#{I3_SITE}/themes/default",
      "#{I3_ROOT}/themes/#{I3.config.theme}", "#{I3_SITE}/themes/#{I3.config.theme}"
    ].each do |theme_dir|
      if File.directory?(theme_dir)
        Dir["#{theme_dir}/client-*"].each { |d| links[File.basename(d)] = d }
      end #if
    end #each
    FileUtils.mkdir_p("#{I3_LOCAL}/files/virtual-root/_theme")
    links.each { |name, path| FileUtils.ln_s path, "#{I3_LOCAL}/files/virtual-root/_theme/#{name}" }
    
    # Build tool symlinks in virtual server root.
    links = {}
    Dir["#{I3_ROOT}/tools/*"].each { |d| links[File.basename(d)] = d if File.directory?(d) }
    if File.directory?("#{I3_SITE}/tools")
      Dir["#{I3_SITE}/tools/*"].each { |d| links[File.basename(d)] = d if File.directory?(d) }
    end #if
    links.each { |name, path| FileUtils.ln_s path, "#{I3_LOCAL}/files/virtual-root/#{name}" }
    
  end #def

  def self.main(args)
    require "#{I3_ROOT}/framework/intranet"
    self.prepare_server unless args.include? "--port"
    settings = {}
    if File.exists?("#{I3_SITE}/config/mongrel.yml")
      settings.merge!(YAML.load(File.read("#{I3_SITE}/config/mongrel.yml")))
    end #if
    if File.exists?("#{I3_LOCAL}/config/mongrel.yml")
      settings.merge!(YAML.load(File.read("#{I3_LOCAL}/config/mongrel.yml")))
    end #if
    settings.symbolize_keys!
    if args.include? "--cluster"
      Cluster.new(settings).start
    else
      settings[:port] = args[args.index("--port") + 1].to_i if args.include? "--port"
      ServerStarter.new(settings).start
    end #if
  end #def

end #module

I3MongrelService.main(ARGV) if __FILE__ == $0
