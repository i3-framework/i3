module Mongrel
  
  class HttpRequest
    
    CR  = "\015"
    LF  = "\012"
    EOL = CR + LF
    
    #
    # Method: is_multipart?
    #
    # Description of method
    #
    def is_multipart?
      not extract_multipart_form_boundary(@params["CONTENT_TYPE"]).nil?
    end #is_multipart?
    
    #
    # Method: split_multipart
    #
    # Copied from CGI::read_multipart.
    #
    # Parameters:
    #   boundary - description
    #
    def split_multipart(boundary=nil, content_length=nil)
      if boundary.nil?
        boundary = extract_multipart_form_boundary(@params["CONTENT_TYPE"])
      end #if
      if content_length.nil?
        content_length = @params["CONTENT_LENGTH"].to_i
      end #if
      
      params = Hash.new([])
      boundary = "--" + boundary
      quoted_boundary = Regexp.quote(boundary, "n")
      buffer = ""
      buffer_size = 10 * 1024
      boundary_end = ""

      # start multipart/form-data
      @body.binmode if defined? @body.binmode
      boundary_size = boundary.size + EOL.size
      content_length -= boundary_size
      
      @body.rewind
      status = @body.read(boundary_size)
      if nil == status
        raise EOFError, "No content body"
      elsif boundary + EOL != status
        raise EOFError, "Bad content body"
      end #if

      loop do
        head = nil
        if content_length > 10240
          require "tempfile"
          body = Tempfile.new("CGI")
        else
          begin
            require "stringio"
            body = StringIO.new
          rescue LoadError
            require "tempfile"
            body = Tempfile.new("CGI")
          end
        end
        body.binmode if defined? body.binmode

        until head and /#{quoted_boundary}(?:#{EOL}|--)/n.match(buffer)

          if (not head) and /#{EOL}#{EOL}/n.match(buffer)
            buffer = buffer.sub(/\A((?:.|\n)*?#{EOL})#{EOL}/n) do
              head = $1.dup
              ""
            end
            next
          end

          if head and ( (EOL + boundary + EOL).size < buffer.size )
            body.print buffer[0 ... (buffer.size - (EOL + boundary + EOL).size)]
            buffer[0 ... (buffer.size - (EOL + boundary + EOL).size)] = ""
          end

          c = if buffer_size < content_length
                @body.read(buffer_size)
              else
                @body.read(content_length)
              end
          if c.nil? || c.empty?
            raise EOFError, "Bad content body"
          end
          buffer.concat(c)
          content_length -= c.size
        end

        buffer = buffer.sub(/\A((?:.|\n)*?)(?:[\r\n]{1,2})?#{quoted_boundary}([\r\n]{1,2}|--)/n) do
          body.print $1
          if "--" == $2
            content_length = -1
          end
          boundary_end = $2.dup
          ""
        end

        body.rewind

        /Content-Disposition:.* filename=(?:"((?:\\.|[^\"])*)"|([^;]*))/ni.match(head)
	      filename = ($1 or $2 or "")
      	if /Mac/ni.match(@params['HTTP_USER_AGENT']) and
      	   /Mozilla/ni.match(@params['HTTP_USER_AGENT']) and
      	   (not /MSIE/ni.match(@params['HTTP_USER_AGENT']))
      	  filename = self.class.unescape(filename)
      	end

        /Content-Type: (.*)/ni.match(head)
        content_type = ($1 or "")

        (class << body; self; end).class_eval do
          alias local_path path
          define_method(:original_filename) { filename.dup.taint }
          define_method(:content_type)      { content_type.dup.taint }
        end #class_eval

        /Content-Disposition:.* name="?([^\";]*)"?/ni.match(head)
        name = $1.dup

        if params.has_key?(name)
          params[name].push(body)
        else
          params[name] = [body]
        end
        
        break if buffer.size == 0
        break if content_length == -1
      end #loop
      
      raise EOFError, "bad boundary end of body part" unless boundary_end =~ /--/

      return params
    end #split_multipart
    
    private
    
    unless defined? MULTIPART_FORM_BOUNDARY_RE
      MULTIPART_FORM_BOUNDARY_RE = %r|\Amultipart/form-data.*boundary=\"?([^\";,]+)\"?|n #"
    end #unless
    
    #
    # Method: extract_multipart_form_boundary
    #
    # Description of method
    #
    # Parameters:
    #   content_type - description
    #
    def extract_multipart_form_boundary(content_type)
      MULTIPART_FORM_BOUNDARY_RE.match(content_type).to_a.pop
    end #extract_multipart_form_boundary
    
  end #class HttpRequest
  
end #module Mongrel