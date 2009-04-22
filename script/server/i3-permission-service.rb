#!/usr/bin/env ruby

#
# Helper Script: server/i3-permission-service
#
# Provides a service for checking actual file permissions for users on the Intranet.  A client 
# will connect through a socket and pass a message that contains the username, permission, and 
# paths that need to be checked.  The service will print back all paths that the supplied user 
# has the supplied permission for among the supplied paths.  The list of the paths will be 
# newline separated.
# 
# The permission should be either 'read' or 'write'.
# 
# Credits:
# 
#   Written by Nathan Mellis (nathan@mellis.us).
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
#   $Id: i3-permission-service.rb 13 2007-12-10 21:44:52Z melfstrand $
#

require "etc"
require "socket"
require "rubygems"
require "fileutils"                       # For setting the working directory
require "yaml"                            # For reading configuration data


#
# Module: I3PermissionService
#
# The module containing the classes for the i3 Documents permission checker
#
module I3PermissionService
  
  # The path of the i3 folder.
  I3_ROOT = File.expand_path(File.dirname(__FILE__) + "/../..")

  #
  # Class: I3PermissionService::PermissionChecker
  #
  # Provides a service that will accept a username, permission, and array of file-system paths and 
  # returns an array of all the paths that the given user has the given permission to access.  
  # This is accomplished by forking a process, setting the userid to the given user and determining 
  # if he/she has real-world permission to access the file.
  # 
  # The service will return a newline-separated string containing all the paths in the given set 
  # that the user has permission to access.
  # 
  # The service operates as a TCPServer and will default to port 7999 on localhost unless 
  # configuration directives are supplied.
  #
  class PermissionChecker
    
    #
    # Method: initialize
    #
    # Initializes the permission checker service.  If supplied, the `settings` hash can be used to 
    # specify which port the service should run on.  If not supplied, it will run on port 7999.
    # 
    # Parameters:
    #   settings - a hash of settings for how this server should run.  See below for a list.
    # 
    # Options:
    #   port - the port number that this service should run on; default = 7999
    #
    def initialize(settings)
      @settings  = settings
      @port      = @settings[:port] || 7999
      @server    = TCPServer.new(@port)
      @log_mutex = Mutex.new
      trap("INT")  { stop }
      trap("TERM") { stop }
    end #initialize
    
    #
    # Method: log_message
    #
    # Logs a message to STDERR.
    #
    # Parameters:
    #   text - a string message to log.
    #
    def log_message(text)
      @log_mutex.synchronize do
        STDERR.puts "%s  %s: %s" % [ Time.now.strftime("%Y/%m/%d %H:%M:%S"), self.class.name, text ]
      end #synchronize
    end #log_message
    
    #
    # Method: start
    #
    # Starts the service listening for permission check requests.  Sockets that connect to this 
    # service should pass in a a YAML string terminated by an empty newline.  The service will then
    # process the request and return each path that the supplied user is allowed to access.
    # 
    # Sample Client
    # (start example)
    # args = Hash.new
    # args[:username]   = "juser"
    # args[:permission] = "read"
    # args[:paths]      = Dir["/Shared Items/*"]
    # 
    # session = TCPSocket.new("localhost", 7999)
    # 
    # YAML.dump(args).each { |line| session.puts line }
    # session.puts      # end with an empty newline
    # 
    # response = ""
    # while output = session.gets
    #   response << output
    # end
    # session.close
    # 
    # puts response
    # (end example)
    #
    def start
      while sid = @server.accept do 

        Thread.new(sid) do |session|
          begin
            text = ""
            while not (input = session.gets) =~ /^\n$/
              text << input
            end
            
            args = YAML.load(text)

            raise "Not enough arguments"  if args.nil?

            username   = args[:username]      # the username we are checking
            permission = args[:permission]    # 'read' or 'write'
            permission ||= "read"             # if no permission is given, default to 'read'
            paths      = args[:paths]         # the remainder of the args are paths to check

            raise "No Username"           if username.nil?
            raise "No Permission"         if permission.nil?
            raise "Invalid Permission"    if (permission =~ /(read)|(write)/).nil?
            raise "No Paths"              if paths.nil? or paths.size < 1

            user = Etc.getpwnam(username)

            IO.popen("-") do |pipe|
              if pipe.nil?
                # We are the child process, setuid and check permissions
                begin
                  # Set the process ID to the user that was passed in
                  Process::UID.change_privilege(user.uid)

                  # Check the appropriate permission and print all paths that pass
                  case permission
                  when "read"
                    paths.each { |path| puts path if File.readable_real?(path) }
                  when "write"
                    paths.each { |path| puts path if File.writable_real?(path) }
                  end #case

                rescue
                  log_message "Error while processing request: '#{text}' (#{$!.message})"
                end #begin

              else # pipe is not nil
                # We are the parent process, write out child output
                while not (line = pipe.gets).nil?
                  session.puts line
                end #while
              end #if

            end #IO.popen

            session.close

          rescue
            # log something here?
            log_message "Error while processing request: '#{text}' (#{$!.message})"
            session.close
          end #begin
        end #Thread

      end #while
    end #start
    
    #
    # Method: stop
    # 
    # Stops the permission checker service.
    # 
    def stop
      exit
    end #def
    
  end #class PermissionChecker

  def self.main(args)
    require "#{I3_ROOT}/framework/intranet"
    settings = I3.config.tools["documents"].settings
    PermissionChecker.new(settings).start
  end #self.main

end #module I3PermissionService

I3PermissionService.main(ARGV) if __FILE__ == $0
