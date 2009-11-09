#
# Web Service: log-viewer/data/search
#
# Place a description for your web service here.
#
# Credits:
# 
#   Written by Nathan Mellis.
# 
# Copyright / License:
# 
#   Copyright 2008 Mission Aviation Fellowship
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
#   $Id: search.rb 1639 2008-08-18 17:42:48Z nmellis $
#

#
# Module: LogViewer
#
# The module containing all Log Viewer classes and data.
#
module LogViewer

  #
  # Class: LogViewer::SearchServlet
  #
  # The main servlet for the Search service.
  #
  class SearchServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Returns a greeting.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_get(path)
      path = path[1..-1] if path.starts_with? "/"
      path = path.split("/")
      
      if path.empty?
        I3.server.send_object I3::ServerException.new
      end #if
      
      begin
        service = Service.new(path.first)
        results = nil
        
        benchmark = Benchmark.measure do
          results = service.search(I3.server.cgi["q"], 
                                  :limit => I3.server.cgi["limit"].to_i, 
                                  :from => I3.server.cgi["from"], 
                                  :history => I3.server.cgi["history"], 
                                  :hosts => I3.server.cgi["host"])
        end #Benchmark.measure
        
        log.info("Log Viewer Search took #{benchmark.total}s")
        
        I3.server.send_object results
      rescue
        log.error $!
        log.error $!.backtrace.join("\n")
        I3.server.send_object I3::ServerException.new($!)
      end #begin
    end #def

  end #class

end #module
