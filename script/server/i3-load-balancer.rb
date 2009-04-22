#!/usr/bin/env ruby

#
# Helper Script: server/i3-load-balancer
#
# Provides load balancing for a cluster of Mongrel servers using `pen`.
#
# The server that this script starts will listen on the port number defined
# in `i3-local/config/mongrel.yml`, and forward requests to Mongrel processes
# based on the cluster size defined in that file (5 by default).
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
#   $Id: i3-load-balancer.rb 121 2008-09-04 15:13:45Z nmellis $
#

require "rubygems"
require "active_support"                  # For symbolizing hash keys
require "yaml"                            # For reading configuration data


#
# Module: I3LoadBalancer
#
# The module containing the classes for the `pen`-based load balancer.
#
module I3LoadBalancer

  # The path of the i3-site folder.
  I3_SITE = File.expand_path(File.dirname(__FILE__) + "/../../../i3-site")

  # The path of the i3-local folder.
  I3_LOCAL = File.expand_path(File.dirname(__FILE__) + "/../../../i3-local")
  

  #
  # Class: I3LoadBalancer::Pen
  # 
  # Configures and starts the `pen` load balancer.
  # 
  class Pen
    
    PID_FILE = "#{I3_LOCAL}/files/.load-balancer.pid"

    #
    # Class Method: new
    # 
    # Returns a new instance of the `pen` service manager with the given
    # options.  The service will not be started until <start> is called.
    # 
    # Parameters:
    #   settings - the settings to be used for the cluster
    # 
    def initialize(settings)
      @port = settings[:port] || 8000
      @cluster_size = settings[:cluster_size] || 5
      trap("INT")  { stop }
      trap("TERM") { stop }
    end #def

    #
    # Method: start
    # 
    # Starts the load balancer.
    # 
    # This method does not return until the server has been stopped by an
    # `INT` or `TERM` signal.
    # 
    def start
      pen_path = "#{I3_LOCAL}/bin/pen"
      unless File.exists?("#{I3_LOCAL}/bin/pen")
        system_pen_path = `which pen`.chomp
        if not system_pen_path.empty?
          pen_path = system_pen_path
        elsif File.exists?("#{I3_SITE}/bin/pen")
          pen_path = "#{I3_SITE}/bin/pen"
        end #if
      end #unless
      args = [ "'#{pen_path}'", "-f", "-H", @port.to_s ]
      @cluster_size.times { |i| args << "localhost:#{@port + i + 1}:1" }
      ios = IO.popen(args.join(" "))
      @pid = ios.pid
      puts "Starting load balancer on port #{@port} (PID #{@pid})."
      life_thread = Thread.new do
        while not (line = ios.gets).nil?
          puts line
        end #while
        ios.close
      end #Thread.new
      life_thread.join
      puts "Stopped load balancer."
    end #def

    #
    # Method: stop
    # 
    # Stops the load balancer.
    # 
    def stop
      puts "Stopping load balancer..."
      begin
        Process.kill("TERM", @pid)
      rescue
        STDERR.puts "Error stopping load balancer: #{$!}"
      end
    end #def

  end #class

  
  def self.main(args)
    settings = {}
    if File.exists?("#{I3_SITE}/config/mongrel.yml")
      settings.merge!(YAML.load(File.read("#{I3_SITE}/config/mongrel.yml")))
    end #if
    if File.exists?("#{I3_LOCAL}/config/mongrel.yml")
      settings.merge!(YAML.load(File.read("#{I3_LOCAL}/config/mongrel.yml")))
    end #if
    settings.symbolize_keys!
    Pen.new(settings).start
  end #def

end #module

I3LoadBalancer.main(ARGV) if __FILE__ == $0
