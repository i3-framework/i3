#
# File: framework/intranet/server
#
# Defines the server-side classes in the <I3> module (<I3::Servlet> and
# <I3::ServerApp>) along with the handlers used for various content types.
#
# *I3::ServerApp*
#
# The <I3::ServerApp> class handles incoming requests for server-side data
# and sends them to the correct servlet.  A single instance of this class is
# created and assigned to the <I3.server> property when the request comes in.
#
# *I3::Servlet*
#
# Each servlet (web service run by the Intranet server application) must be
# a subclass of the <I3::Servlet> class.  Servlets must implement at least
# one of the following methods:
#
#   on_get(path)    - to handle an HTTP `GET` request
#   on_put(path)    - to handle an HTTP `PUT` request
#   on_post(path)   - to handle an HTTP `POST` request
#   on_delete(path) - to handle an HTTP `DELETE` request
#
# The `path` passed to the methods is the extra path information following
# the servlet name in the URI.  For example, if the client sent a GET request
# for the URI "contacts/data/people/123", the `on_get` method would be called
# on the servlet defined in "contacts/data/people.rb", and "123" would be
# passed in as the `path`.
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
#   $Id: server.rb 140 2008-12-02 22:14:58Z nmellis $
#

require "mongrel"                             # For handling requests
require "mongrel_multipart_extensions"        # Multipart extensions for Mongrel
require "intranet/cgi-wrapper"                # Custom CGI wrapper
require "benchmark"                           # For timing requests
require "objective-js"                        # For sending JavaScript files

require "common/data/model/person"            # For checking permissions


#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  # Mutex used to synchronize code that uses Active Record.
  SERVER_MUTEX = Mutex.new


  # --------------------------------------------------------------------------
  # Handler base class
  # --------------------------------------------------------------------------

  #
  # Class: I3::SecuredRequestHandler
  #
  # Base class for all request handlers.
  #
  # This checks to ensure that the remote user has "access-tool" permissions
  # for the resource being requested, and calls <process_authorized> if so.
  # Subclasses are expected to override `process_authorized`.
  #
  class SecuredRequestHandler < Mongrel::HttpHandler
    include LoggingSupport

    #
    # Constant:  ERROR_TEMPLATE
    #
    # A `printf`-style template to use for constructing HTML error messages.
    #
    # TODO:
    # Use <I3::Template> with an attractive HTML design for error messages,
    # once we have client-specific templates set up for `common/data/index`.
    #
    ERROR_TEMPLATE =
      '<html><body><h1>%s</h1><p><strong>%s</strong></p><p>%s</p></body></html>'

    #
    # Method: process
    #
    # Overrides `Mongrel::HttpHandler::process` to check security before
    # processing the request.
    #
    # Parameters:
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process(request, response)
      begin
        path = request.params["REQUEST_URI"]
        if request.params["REMOTE_USER"].nil? and not request.params["HTTP_X_FORWARDED_USER"].nil?
          request.params["REMOTE_USER"] = request.params["HTTP_X_FORWARDED_USER"]
        end #if
        remote_user = request.params["REMOTE_USER"]
        tool = path.split("/")[1]
        account_exists = false
        is_authorized = false
        acct = nil
        if remote_user.to_s.size > 0
          SERVER_MUTEX.synchronize do
            # We need to use Active Record to check permissions, which is
            # not thread safe, and thus must be in a `synchronize` block.
            acct = I3::Account.find_or_create(request.params["REMOTE_USER"])
            account_exists = true unless acct.nil?
            is_authorized = true if (account_exists and (
              acct.has_permission?("access-tool", tool) or
              acct.has_permission?("develop", "i3-root") or
              tool == "common" or tool == "$theme" ))
          end #synchronize
        end #if
        if is_authorized
          self.process_authorized(request, response)
        elsif account_exists
          # No authorization
          self.process_error(I3::SecurityException.new, request, response)
          log.warn 'Unauthorized access attempt by %s for path: %s' % [acct.to_s, path]
        else
          # Account does not exist.
          self.process_error(I3::SecurityException.new, request, response)
          log.warn 'Attempted access by nonexistent account "%s" for path: %s' %
            [acct.to_s, path]
        end #if
      rescue ServerException => ex
        self.process_error($!, request, response)
      rescue Exception => ex
        self.process_error(I3::ServerException.new, request, response)
        log.fatal "#{ex}\n  Backtrace:\n  " + ex.backtrace.join("\n  ")
      end
    end #def

    #
    # Method: process_authorized
    #
    # Called when the user has passed the basic "access-tool" permission check
    # and the resource may be accessed.
    #
    # This must be overridden by subclasses to send the resource.  The default
    # implementation sends a "500 Internal Server Error" to the client.
    #
    # Parameters:
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process_authorized(request, response)
      self.process_error(I3::ServerException.new, request, response)
      log.fatal "process_authorized not implemented in #{self.class.name}"
    end #def
    
    #
    # Method: process_error
    #
    # Called when an exception has been encountered while handling a
    # request.  The default implementation sends an error to the client
    # in HTML format.
    #
    # Parameters:
    #   error_info - an instance of <I3::ServerException> or one of its
    #     subclasses (see <framework/intranet/exception>)
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process_error(error_info, request, response)
      response.status = error_info.status_code
      response.header["Content-Type"] = "text/html"
      response.body << ERROR_TEMPLATE % [
        error_info.title, error_info.message, error_info.help ]
    end #def

  end #class SecuredRequestHandler


  # --------------------------------------------------------------------------
  # Secured handlers
  # --------------------------------------------------------------------------

  #
  # Class: I3::WebServiceHandler
  #
  # Handles incoming requests for web services.
  #
  # This loads the <Servlet> subclass for the requested path and calls the
  # appropriate method (e.g. `on_get`).
  #
  class WebServiceHandler < SecuredRequestHandler

    #
    # Method: process_authorized
    #
    # Overrides <I3::SecuredRequestHandler> to load an <I3::Servlet> instance
    # to handle the request.
    #
    # Parameters:
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process_authorized(request, response)
      request_info = "%s request from %s (%s) for %s" % [
        request.params["REQUEST_METHOD"], request.params["REMOTE_USER"],
        request.params["REMOTE_ADDR"], request.params["REQUEST_URI"] ]
      log.debug "[START] #{request_info}"
      benchmark_result = Benchmark.measure do
        match = request.params["REQUEST_URI"].match(%r'^/([^/]+)/data/([^/\?]+)([^\?]*)')
        raise I3::NotFoundException.new if match.nil?
        tool_name, servlet_name, extra_path = match[1], match[2], match[3]
        SERVER_MUTEX.synchronize do
          I3.server = I3::ServerApp.new(request, response)
          begin

            # Instantiate the servlet.
            tool = I3.config.tools[tool_name]
            raise I3::NotFoundException.new if tool.nil?
            servlet_class = tool.servlets[servlet_name]
            raise I3::NotFoundException.new if servlet_class.nil?
            servlet = servlet_class.new
          
            # Call the appropriate method.
            available_methods = servlet.available_methods
            if available_methods.include? request.params["REQUEST_METHOD"]
              servlet.handle_http_method(request.params["REQUEST_METHOD"], extra_path)
            else
              # HTTP method is not handled by this servlet.
              log.info "Client (%s) requested missing method '%s' for servlet %s" % [
                request.params["REMOTE_USER"], request.params["REQUEST_METHOD"],
                servlet_class.name ]
              if available_methods.empty?
                I3.server.send_error(I3::NotFoundException.new)
              else
                available_methods = available_methods.join(", ")
                I3.server.send_error(I3::ServerException.new(
                  :status => 405,
                  :title => "Method Not Allowed",
                  :message => "The %s method is not supported by this service." %
                              request.params["REQUEST_METHOD"],
                  :help => "Available methods: " + available_methods,
                  :headers => { "Allow" => available_methods }
                ))
              end #if
            end #if

          ensure
            I3.server = nil
          end
        end #synchronize
      end #measure
      log.debug "[END] #{request_info} (#{benchmark_result.total}s)"
    end #def

    #
    # Method: process_error
    #
    # Overrides <I3::SecuredRequestHandler> to send the error data
    # in JSON format using <I3::ServerApp::send_error>.
    #
    # Parameters:
    #   error_info - an instance of <I3::ServerException> or one of its
    #     subclasses (see <framework/intranet/exception>)
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process_error(error_info, request, response)
      SERVER_MUTEX.synchronize do
        server = I3.server || I3::ServerApp.new(request, response)
        server.send_error(error_info)
      end #synchronize
    end #def

  end #class WebServiceHandler
  
  
  #
  # Class: I3::StaticFileHandler
  #
  # Base class for request handlers that send static files.
  # Subclasses should call `set_content_type` in their class
  # definitions with the content type that they return.
  # The default is "text/html".
  #
  # The intranet keeps a cache of compressed client files (e.g. with
  # unnecessary white space removed), which this handler will use to
  # send files that are already compressed.  When a file does not have
  # an up to date cached version, the <compress> method is called to
  # create a cache file.
  #
  # Subclasses should override <compress> to perform any file
  # content compression.  Note that this is separate from gzip
  # compression when the file is sent to the browser, which is
  # handled for each request by <GzipFilter>.
  #
  class StaticFileHandler < SecuredRequestHandler
    overridable_cattr_accessor :content_type
    set_content_type "text/html"

    #
    # Method: process_authorized
    #
    # Overrides <I3::SecuredRequestHandler> to send a static file
    # to the client, compressing white space if applicable.
    #
    # Parameters:
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process_authorized(request, response)

      # Synchronize to prevent concurrent access to I3 objects.
      SERVER_MUTEX.synchronize do

        # Extract file revision from file path.
        path = request.params["REQUEST_PATH"]
        if path =~ %r'^(.+\.\w+)/([A-Fa-f0-9]+)$'
          # Path contains a revision date.
          # Extract the date and set the path to the part before the date.
          path, revision = [ $1, $2 ]
        else
          # Requested path contains no revision date.
          # Set the date to the earliest possible to force a redirect
          # to the latest revision.
          revision = "0"
        end #if

        # Check for existence of file.
        full_path = I3.resource(path)
        raise I3::NotFoundException.new unless File.exist? full_path

        # See if the client's requested revision date is the latest one.
        latest_revision = self.current_revision_of_file(full_path)
        if revision != latest_revision
          # Requested revision is not the latest one.
          # Send a "Moved Permanently" redirect to the latest revision
          # so that the client is forced to cache the new file.
          log.debug "Client requested outdated version of #{path} (#{revision} != #{latest_revision})"
          response.status = 301
          response.header["Location"] = "#{path}/#{latest_revision}"
          return
        end #if

        # See if the client sent an If-Modified-Since header, which means
        # it has already cached this path.  This specific path will always
        # return the same data, so the client should always get a not-modified
        # response in this case.
        if request.params["HTTP_IF_MODIFIED_SINCE"].to_s.size > 0
          response.status = 304
          return
        end #if
      
        # See if we have a pre-compressed cached copy.
        have_cached = false
        key = "compress" + path.gsub("$", "_") + "/" + latest_revision
        if I3.cache.exist?(key, "common")
          cached_at = I3.cache.get_info(key, "common").modified_at
          have_cached = true if cached_at > File.mtime(full_path)
        end #if
        
        # Create cached file if necessary.
        if I3.cache.exist?(key, "common")
          log.debug("Sending cached file for path: #{path}/#{latest_revision}")
        else
          benchmarkResult = Benchmark.measure do
            I3.cache.write(key, "common") do |output|
              File.open(full_path) { |input| self.compress(input, output) }
            end #write
          end #measure
          log.debug("Cached file for path: #{path}/#{latest_revision} (#{benchmarkResult.total}s)")
        end #unless

        # Send the compressed copy with headers that allow the client to cache it
        # for one year (the maximum allowed by the HTTP spec), since the requested
        # path will change when the file changes.
        response.status = 200
        response.header["Content-Type"] = self.content_type
        response.header["Cache-Control"] = "public, max-age=" + (Time.now + 1.year).to_i.to_s
        response.header["Expires"] = Time.now + 1.year
        response.header["Last-Modified"] = File.mtime(full_path)
        I3.cache.read(key, "common") { |input| response.body << input.read }

        # Add the content type to the request parameters for the gzip filter.
        request.params["Response-Content-Type"] = self.content_type
        
      end #synchronize

    end #def

    #
    # Method: current_revision_of_file
    # 
    # Returns the latest revision identifier for the given
    # file path.  If the client requests a revision other than
    # this, it will be forwarded to the latest revision.
    # 
    # The default implementation uses the modification time of
    # the file to generate the revision string.  Subclasses may
    # override this to provide their own implementations.
    # 
    # Parameters:
    #   path - the full path to the file
    # 
    # Returns:
    #   The latest revision identifier as a `String`.
    # 
    def current_revision_of_file(path)
      File.mtime(path).to_i.to_s(16)
    end #def
    
    #
    # Method: compress
    #
    # Writes data from an input stream to an output stream,
    # processing it as necessary.
    #
    # Subclasses should override this method to remove unnecessary
    # white space and comments from static files.  The streams will
    # provide the read/write methods expected of `IO` objects (though
    # it is not guaranteed that they will be `IO` subclasses).
    #
    # Parameters:
    #   input - the input stream
    #   output - the output stream
    #
    def compress(input, output)
      output.write(input.read)
    end #def

  end #class

  
  # --------------------------------------------------------------------------
  # Static file handlers
  # --------------------------------------------------------------------------

  #
  # Class: I3::CSSHandler
  #
  # Processes requests for CSS files.
  #
  class CSSHandler < StaticFileHandler
    set_content_type "text/css"

    #
    # Method: compress
    #
    # Overrides <I3::StaticFileHandler::compress> to remove comments
    # and extra white space from CSS files.
    #
    # Parameters:
    #   input - the input stream
    #   output - the output stream
    #
    def compress(input, output)
      text = input.read
      text.gsub!(%r'/[*].*?[*]/'m, "")  # Remove /*...*/ style comments
      text.gsub!(%r'\s*\n\s*'m, "\n")   # Remove extra whitespace
      output.write(text)
    end #def
    
  end #class CSSHandler
  
  
  #
  # Class: I3::HTMLHandler
  #
  # Processes requests for HTML files.
  #
  class HTMLHandler < StaticFileHandler
    set_content_type "text/html"

    #
    # Method: compress
    #
    # Overrides <I3::StaticFileHandler::compress> to remove comments
    # and extra white space from HTML files.
    #
    # Parameters:
    #   input - the input stream
    #   output - the output stream
    #
    def compress(input, output)
      pre_level = 0  # Not inside a <pre> block
      text = input.read
      text.gsub!(%r'<!--.*?-->'m, "")  # Remove <!--...--> style comments
      text.split("\n").each do |line|
        line_downcased = line.downcase
        pre_level += 1 if line_downcased.include? "<pre>"
        # Only process if not inside a <pre> block.
        unless pre_level > 0
          # Remove white space.
          line.gsub!(%r'\s+', " ")
          # Add modification times to CSS file paths.
          if line =~ %r' href="([^"]+\.css)"'
            path = $1
            line.sub!(path, path + "/" + File.mtime(I3.resource(path)).to_i.to_s(16))
          end #if
          # Add modification times to JavaScript file paths.
          if line =~ %r' src="([^"]+\.js)"'
            path = $1
            line.sub!(path, path + "/" + File.mtime(I3.resource(path)).to_i.to_s(16))
          end #if
        end #unless
        output.puts line unless line.strip.size == 0 and pre_level == 0
        pre_level -= 1 if line_downcased.include? "</pre>"
      end #each
    end #def

    #
    # Method: current_revision_of_file
    # 
    # Overrides <I3::StaticFileHandler::current_revision_of_file> to return
    # the revision number provided by `I3.config` for applet files.
    # 
    # Parameters:
    #   path - the full path to the file
    # 
    # Returns:
    #   The latest revision identifier as a `String`.
    # 
    def current_revision_of_file(path)
      if path =~ %r'/([^/]+)/(client-[^/]+)/html/([^/]+)\.html$'
        tool_name, client_type, applet_name = [ $1, $2, $3 ]
        remote_path = I3.config.tools[tool_name].applets[client_type][applet_name].remote_path
        remote_path.match(%r'/([^/]+)$')[1]  # Extracts revision following last slash
      else
        super
      end #if
    end #def
    
  end #class HTMLHandler


  #
  # Class: I3::JavaScriptHandler
  #
  # Processes requests for JavaScript files.
  #
  class JavaScriptHandler < StaticFileHandler
    set_content_type "text/javascript"
    
    #
    # Method: compress
    #
    # Overrides <I3::StaticFileHandler::compress> to transform
    # Objective-JS input into standard JavaScript code, removing
    # comments and extra white space in the process.
    #
    # Parameters:
    #   input - the input stream
    #   output - the output stream
    #
    def compress(input, output)
      processor = ObjectiveJS::Processor.new
      processor.enable_applet
      processor.enable_compression
      processor.process(input, output)
    end #def
    
  end #class JavaScriptHandler


  # --------------------------------------------------------------------------
  # HTTP response filters
  # --------------------------------------------------------------------------

  #
  # Class: I3::GzipFilter
  #
  # Replacement for Mongrel's `DeflateFilter` that checks the content
  # type and size before applying gzip compression.
  #
  # See <process> for details.
  #
  class GzipFilter < Mongrel::HttpHandler
    
    # Minimum size of content (in bytes) to be eligible for compression.
    MIN_SIZE = 100
    
    #
    # Method: process
    #
    # Overrides `Mongrel::HttpHandler::process` to apply gzip compression
    # to the `response`, if applicable.
    #
    # Not all content will benefit from gzip compression.  In particular,
    # pre-compressed data like images will frequently be made larger.
    # Data that is less than 100 bytes -- even text -- will also see no
    # benefits from gzip compression.  Since web services are free to send
    # any kind of content, we need to check to make sure the content is
    # eligible for compression before modifying the response.
    #
    # Mongrel provides no read access to headers that have been already
    # sent (such as "Content-Type"), so the various intranet handlers
    # append an extra request parameter called "Response-Content-Type"
    # that this filter checks.  If the content type is one of the "text"
    # MIME types and meets the size requirement, and if the client supports
    # it, the content will be gzip-encoded.  Otherwise the response will
    # be left alone.
    #
    # Parameters:
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def process(request, response)
      if request.params["HTTP_ACCEPT_ENCODING"].to_s.include? "gzip" and
          response.body.size > MIN_SIZE and not response.body_sent and
          request.params["Response-Content-Type"].to_s[0..4] == "text/"
        response.header["Content-Encoding"] = "gzip"
        response.body.rewind
        io = StringIO.new
        gz = Zlib::GzipWriter.new(io)
        gz.write(response.body.read)
        gz.finish
        io.rewind
        response.body.close
        response.body = io
      end #if
    end #def
    
  end #class
  

  # --------------------------------------------------------------------------
  # Servlet base class
  # --------------------------------------------------------------------------

  #
  # Class: I3::Servlet
  # Base class for all intranet servlets.
  #
  class Servlet
    include LoggingSupport

    # Used by <I3::Tool> to determine which servlet class
    # was loaded by a file.  See <inherited>.
    cattr_accessor :last_servlet_loaded

    #
    # Constructor: new
    #
    # Returns a new instance of the servlet.
    #
    # Servlets should *not* override the `initialize` method.  If the
    # servlet has initialization to do, it should define an `on_init` method
    # and do it there.
    #
    def initialize
      # Call subclass on_init method if applicable.
      self.on_init if self.respond_to? :on_init
    end #def

    #
    # Method: available_methods
    #
    # Returns the array of HTTP method strings to which the servlet responds.
    #
    def available_methods
      list = []
      list << "GET"    if self.respond_to? :on_get
      list << "POST"   if self.respond_to? :on_post
      list << "PUT"    if self.respond_to? :on_put
      list << "DELETE" if self.respond_to? :on_delete
      list
    end #def

    #
    # Method: handle_http_method
    #
    # Calls the appropriate HTTP method handler for the given string.
    #
    # Parameters:
    #   http_method - the HTTP method string to handle, e.g. "GET"
    #   extra_path - additional path string following the servlet name
    #     in the requested URI
    #
    def handle_http_method(http_method, extra_path)
      extra_path = CGI.unescape(extra_path)
      case http_method
        when "GET"
          self.on_get extra_path
        when "POST"
          self.on_post extra_path
        when "PUT"
          self.on_put extra_path
        when "DELETE"
          self.on_delete extra_path
      end #case 
    end #def
    
    #
    # Class Method: inherited
    #
    # Automatically called by Ruby when a subclass of <Servlet> is defined.
    # This notifies the framework that a new servlet definition has been
    # loaded so that it can cache it.
    #
    def self.inherited(subclass)
      self.last_servlet_loaded = subclass
    end #def

  end #class


  # --------------------------------------------------------------------------
  # Server class
  # --------------------------------------------------------------------------

  #
  # Class: I3::ServerApp
  #
  # Main request handler for the Intranet server.
  #
  # All requests that are made to URIs of the form "/tool/data/servlet/..."
  # are sent to the shared instance of this class.  It parses out the tool
  # and servlet names and loads the appropriate servlet script to handle
  # the request.
  #
  class ServerApp
    include LoggingSupport

    # ------------------------------------------------------------------------
    # Group: Constructor
    # ------------------------------------------------------------------------

    #
    # Constructor: new
    #
    # Initializes the intranet server application.
    #
    # Parameters:
    #   request - the Mongrel `HttpRequest` object
    #   response - the Mongrel `HttpResponse` object
    #
    def initialize(request, response)
      @request = request
      @response = response
    end #def


    # ------------------------------------------------------------------------
    # Group: Remote Account Info
    # ------------------------------------------------------------------------

    #
    # Property: remote_account
    #
    # The <I3::Account> data model for the current intranet user.
    # Read only.
    #
    def remote_account
      self.remote_account_as(Account)
    end #def

    #
    # Method: remote_account_as
    #
    # Returns the current intranet user as a data model of a different type.
    #
    # Parameters:
    #   account_class - The class to use when returning the user object.
    #     The class must inherit from <I3::Account>.
    #
    # Raises:
    #   `ArgumentError` if the class does not inherit from <I3::Account>.
    #
    def remote_account_as(account_class)
      if account_class.ancestors.include? Account
        return account_class.find_or_create(@request.params["REMOTE_USER"])
      else
        raise ArgumentError,
          "The specified account class #{account_class} does not inherit " +
          "from I3::Account."
      end #if
    end #def


    # ------------------------------------------------------------------------
    # Group: Sending Data
    # ------------------------------------------------------------------------

    #
    # Method: send_header
    #
    # Sets the HTTP headers to be sent to the browser.
    #
    # The `options` parameter is a `Hash` of header key/value pairs.
    # You can use any standard HTTP header as a key, but aliases are
    # provided for some of the more frequently used headers.  One of
    # the most frequently set is `:type` , which is sent to the client
    # as the "Content-Type" header.  This defaults to "text/javascript",
    # the format sent by the <send_object> method.  If you're sending
    # some other kind of data, such as "text/html", you'll need to set
    # the `:type` header appropriately.  Some other recognized header
    # aliases are:
    #
    #   :status - the HTTP status code, sent as the "Status" header.
    #     See the list of status codes below.
    #   :language - the language of the content, sent as the
    #     "Content-Language" header
    #   :expires - a `Time` object representing the date and time at which
    #     the current content expires, sent as the "Expires" header.
    #     Setting this will enable caching of content; by default, the
    #     browser is instructed not to cache any web service responses.
    #   :cookie - a cookie or cookies, sent as one or more "Set-Cookie"
    #     headers.  The value can be the literal string of the cookie;
    #     a `CGI::Cookie` object; an `Array` of literal cookie strings;
    #     an `Array` of `CGI::Cookie` objects; or a `Hash`, all of whose
    #     values are either literal cookie strings or `CGI::Cookie` objects.
    #
    # Again, you are not limited to just the recognized header aliases;
    # you can use any standard HTTP header, such as `"Location"` or `"Date"` .
    #
    # The `:status` header defaults to `"200 OK"` , the standard all-is-well
    # response for HTTP.  There are many other codes that may be useful for
    # sending to the client, such as:
    #
    #   "201 Created" - sent when the client has made a `PUT` or `POST`
    #     request that resulted in the creation of a new resource.  The
    #     URI of the new resource should be returned in a "Location" header.
    #   "206 Partial Content" - sent when the client has explicitly requested
    #     a range of data via the "Range" header, and the requested part
    #     is being returned.  When using this status, you must always send
    #     the "Content-Range" and "Date" headers as well.
    #   "301 Moved Permanently" - sent when the URI for the requested resource
    #     has changed, and the client should start using the new URI instead.
    #     This is useful for maintaining compatibility when you have to
    #     change the URI scheme.  The new URI should be returned in a
    #     "Location" header.
    #   "302 Found" - sent when the URI for the requested resource can be
    #     temporarily found at a different address, but the client should
    #     continue to use the same URI.  This is useful, for example, when
    #     you want to define a URI like "version/latest", that automatically
    #     redirects to something like "version/2.0.1"; you want the client
    #     to make a request for that specific version right now, but you
    #     still want the client to request "version/latest" in the future.
    #     The URI to use temporarily should be returned in a "Location"
    #     header.
    #   "304 Not Modified" - sent when the client has specifically included
    #     an "If-Modified-Since" header, and the resource has not been
    #     modified since the date the client specified.  This allows cache
    #     systems to reduce the amount of data they have to transfer.
    #   "400 Bad Request" - sent when the client's request is not properly
    #     formed and the server cannot understand it.
    #   "403 Forbidden" - sent when the client is not authorized to access
    #     the requested resource.  This is generally sent when the web
    #     service has called <I3::Account::has_permission?> and gotten `false`
    #     as the response.
    #   "404 Not Found" - the most infamous error, sent when the requested
    #     URI does not exist.
    #   "409 Conflict" - sent when the client has made a request that
    #     conflicts with the current state of the resource.  This is most
    #     frequently used with `PUT` or `POST` requests to notify the client
    #     that the resource it is trying to modify has been changed since the
    #     client received it.
    #   "410 Gone" - similar to "404 Not Found", but specifically used when
    #     you know that the resource in question _used_ to be there, but
    #     no longer is (i.e. it was deleted, and you want the client to know
    #     that).
    #   "412 Precondition Failed" - this is a generic error for when the
    #     client made specific conditions on the request in the headers that
    #     it sent, and the server cannot return the resource because it
    #     does not match the conditions.
    #   "416 Requested Range Not Satisfiable" - the error version of
    #     the "206 Partial Content" response; this is when the client has
    #     specifically included a "Range" header and it was outside the
    #     available range for the resource.  When using this status, you
    #     should send a "Content-Range" header that tells the client what
    #     the valid range is.
    #   "500 Internal Server Error" - the generic response for when something
    #     has gone wrong on the server side and there's nothing the client
    #     can do about it.
    #   "503 Service Unavailable" - sent when there's a temporary condition
    #     preventing the server from handling the request, but the client
    #     might want to try back later.  If it is known how long the service
    #     will be down, a "Retry-After" header can be sent to the client to
    #     let it know when to try again.
    #
    # Most of the time you will not need to call <send_header> yourself;
    # the <send_object> and <send_error> methods will take care of it
    # for you.
    #
    # Parameters:
    #   options - the `Hash` of CGI header options to send.
    #
    # See Also:
    #   The Ruby documentation for the `CGI#header` method,
    #   and the "Status Code Definitions" section of RFC 2616
    #   (http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html).
    #
    def send_header(options={})
      
      # Convert CGI-style options into real headers.
      options["Content-Type"] = options.delete(:type) if options.has_key? :type
      options["Status"] = options.delete(:status) if options.has_key? :status
      options["Content-Language"] = options.delete(:language) if options.has_key? :language
      options["Expires"] = options.delete(:expires) if options.has_key? :expires
      
      # Set defaults for missing options.
      options["Content-Type"] = "text/javascript" unless options.has_key? "Content-Type"
      if options.has_key? "Expires"
        options["Cache-Control"] = "private" unless options.has_key? "Cache-Control"
      else
        options["Expires"] = Time.at(0)
        options["Cache-Control"] = "no-cache, must-revalidate"
      end #if
      
      # Handle cookies.
      cookie_option = options.delete(:cookie)
      cookies = case cookie_option
        when Array
          cookie_option
        when Hash
          cookie_option.values
        else
          [ cookie_option ]
      end #case
      
      # Set the response headers.
      status_code = options.delete("Status").to_i
      status_code = (options.has_key? "Location") ? 302 : 200 if status_code == 0
      @response.status = status_code
      options.each { |k, v| @response.header[k] = v if k.is_a? String }
      cookies.each { |c| @response.header["Set-Cookie"] = c unless c.nil? }
      
      # Add the content type to the request parameters for the gzip filter.
      @request.params["Response-Content-Type"] = options["Content-Type"]
      
    end #def

    #
    # Property: client_cached_since?
    # 
    # Checks the `If-Modified-Since` header sent by the client (if any)
    # and returns `true` if the client has cached the requested resource
    # since the given date.
    # 
    # Parameters:
    #   last_modified_date - the date the resource was last modified
    # 
    # Returns:
    #   `true` if the client has cached the resource since it was last
    #   modified, `false` if the resource needs to be re-sent
    # 
    def client_cached_since?(last_modified_date)
      last_cache_header = @request.params["HTTP_IF_MODIFIED_SINCE"].to_s
      return false unless last_cache_header.size > 0
      request_uri = @request.params["REQUEST_URI"]
      result = (Time.parse(last_cache_header) > last_modified_date)
      return result
    end #def

    #
    # Method: send_bytes
    # 
    # Sends data to the client.
    # 
    # The `data` may be either a `String` (containing text or binary data)
    # or an `IO` object (including `StringIO`).  Any other type of object
    # will be converted to a string using `to_s`.
    # 
    # Note that <send_header> *must* be used before calling this method,
    # specifying a "Content-Type" for the data that is being sent.
    # 
    # This method may be called multiple times to append more data to the
    # response.
    # 
    # Parameters:
    #   data - the data to send to the client
    #   options - optional; a `Hash` of additional header options to send
    # 
    def send_bytes(data)
      if data.is_a?(IO) or data.is_a?(StringIO)
        @response.body << data.read
      else
        @response.body << data.to_s
      end #if
    end #def

    #
    # Method: send_object
    #
    # Sends a JSON-encoded object to the client.
    # 
    # Objects sent using this method must either support the `to_json`
    # method directly, or they must have a `to_shared` method that returns
    # an <I3::SharedObject> instance.  JSON support is already built into
    # the most common objects: `Numeric` , `String` , `Time` , `Array` ,
    # and `Hash` values are all supported.  If you want to define your own
    # class that can be sent to the client, you can inherit from
    # <I3::SharedObject>.  Note that data models descending from <I3::Record>
    # have the `to_shared` method already built in.
    #
    # The `options` parameter can be used to provide additional headers
    # when the object is sent, such as cache directives for the client
    # (using the `:expires` key).  See <send_header> for details.
    # 
    # If the object is an instance of <I3::ServerException> or one of its
    # subclasses, it will be forwarded to <send_error>.
    #
    # Examples:
    # (start example)
    # 
    #   # Send an object that may not be cached.
    #   I3.server.send_object(obj)
    # 
    #   # Send an object with a cache lifetime of one hour.
    #   I3.server.send_object(obj, :expires => Time.now + 1.hour)
    # 
    # (end example)
    #
    # Parameters:
    #   obj - the object to encode
    #   options - optional; a `Hash` of additional header options to send
    #
    # See Also:
    #   <I3::SharedObject>
    #
    def send_object(obj, options={})
      if obj.is_a? ServerException
        self.send_error(obj)
        return
      end #if
      json = case
        when obj.respond_to?(:to_json)
          obj.to_json
        when obj.respond_to?(:to_shared)
          obj.to_shared.to_json
        else
          nil
      end #case
      if json.nil?
        raise ArgumentError, "The #{obj.class.name} object being sent " +
          "does not support the to_json or to_shared methods."
        return
      end #if
      self.send_header(options)
      self.send_bytes(json)
    end #def

    #
    # Method: send_cached_object
    #
    # Sends an object from the cache to the client without any additional
    # processing.  The object will sent in the same way as `send_object`.
    # If the key cannot be found, the JSON value "null" will be sent.
    # 
    # The `options` hash supports a `:tool` option for providing the name
    # of the tool that cached the object.  By default, the name of the
    # tool handling the current request is used.  The `options` hash
    # also supports any keys supported by <send_header>; these will only
    # be used when the header has not already been sent.
    #
    # Parameters:
    #   key - the key of the object to send from the cache
    #   options - optional; a `Hash` of additional options
    #
    # See Also:
    #   <I3::Cache>
    #
    def send_cached_object(key, options={})
      tool = options.delete(:tool)
      json = "null"
      begin
        I3.cache.read(key, tool) { |input| json = input.read }
      rescue
        log.warn "Could not send cached object '#{key}': " + $!.to_s
      end
      self.send_header(options)
      self.send_bytes(json)
    end #def

    #
    # Method: send_error
    #
    # Sends an error to the client.  The response will include a JSON-encoded
    # object that contains `title`, `message`, and `help` fields.
    #
    # The `error_info` parameter should be an instance of
    # <I3::ServerException> or one of its subclasses.
    # For backwards compatibility, the method also supports a `Hash`
    # argument that contains the necessary fields, but this usage is
    # deprecated and will be removed in the future.
    #
    # While the client is free to do anything with the fields, as a general
    # rule the `title` will be used as a page or alert title, the `message`
    # will be displayed in strong type, and the `help` will be displayed
    # as normal text.
    #
    # Example:
    # (start example)
    #   I3.server.send_error(I3::SecurityException.new(
    #       :message => "You do not have permission to fly the X-Wing."))
    # (end example)
    #
    # Parameters:
    #   error_info - the server exception object to send
    #
    def send_error(error_info)
      
      # Convert error_info from a Hash to an Exception object if necessary
      if error_info.is_a? Hash or error_info.nil?
        log.warn "Error is not a ServerException object: #{error_info.to_json}"
        error_info = ServerException.new(error_info)
      end #if
      
      # Send the data.
      headers = error_info.headers.merge({ :type => "text/javascript" })
      self.send_object(error_info.to_shared, headers)

    end #def

    #
    # Method: send_not_modified
    #
    # Outputs a "304 Not Modified" header with an empty body.
    #
    def send_not_modified
      self.send_header(:status => "304 Not Modified")
    end #def

    def send_304
      log.warn "send_304 is deprecated.  Use send_not_modified."
      self.send_not_modified
    end


    # ------------------------------------------------------------------------
    # Group: Receiving Data
    # ------------------------------------------------------------------------
    
    #
    # Method: cgi
    #
    # Provides the CGI query values sent in the URL of the request,
    # if applicable.
    # 
    # Returns:
    #   A `Hash` of key/value pairs.
    #
    def cgi
      @cgi = CGIWrapper.new(I3.server.request) if @cgi.nil?
      @cgi
    end #cgi

    #
    # Method: request
    # 
    # Provides the request data to which the server is responding.
    #
    # Returns:
    #   The `Mongrel::HttpRequest` object provided to the server.
    # 
    attr_reader :request
    
    #
    # Method: receive_object
    #
    # Decodes the JSON-encoded object sent in the request.
    #
    # When the client makes a `PUT` or `POST` request, it will frequently
    # be providing data in JSON format.  This converts the JSON into an
    # <I3::SharedObject> that can then be treated attribute style (using
    # methods to obtain data, like any other Ruby object) or `Hash` style
    # (complete with key-value enumeration).
    #
    # Returns:
    #   The decoded <I3::SharedObject> instance.
    #
    # Raises:
    #   `RuntimeError` if the client did not send "text/javascript" data.
    #
    def receive_object
      if @request.params["HTTP_CONTENT_TYPE"].starts_with? "text/javascript"
        source = @request.body.string.unescape_unicode
        begin
          obj = JSON.parse(source)
        rescue JSON::ParserError
          obj = YAML.load("--- " + source)
        rescue
          raise "Could not parse object:\n#{source}"
        end #begin
        return SharedObject.convert_hashes(obj)
      else
        raise "Object could not be received.  No data of type text/javascript was sent."
      end #if
    end #def
    
  end #class


  # --------------------------------------------------------------------------
  # Section: I3 module extensions
  # --------------------------------------------------------------------------

  #
  # Property: I3.preferences
  # 
  # The user preferences for the account currently accessing the intranet
  # (<I3::PreferenceCollection>).
  #
  def self.preferences
    return self.server.remote_account.preferences
  end #def

  #
  # Property: I3.server
  #
  # The shared instance of the intranet server application (<I3::ServerApp>).
  #
  def self.server
    return @_server
  end #def
  def self.server=(new_server)
    @_server = new_server
  end #def

end #module
