#
# File: framework/i3-mailer
#
# Provides mail support for the intranet.
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
#   $Id: i3-mailer.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "action_mailer"
require "net/imap"

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class: I3::Mailer
  #
  # Base class for tool-specific classes that send e-mail.
  #
  class Mailer < ActionMailer::Base
    overridable_cattr_accessor :tool_name
    set_tool_name "common"
    
    # Make sure we have a valid settings hash; use "common" if the tool is not specified
    settings = (I3.config.mail_settings[self.tool_name] or I3.config.mail_settings.common)
    
    self.delivery_method = settings.outgoing.protocol.to_sym
    if self.delivery_method != :sendmail
      self.server_settings = settings.outgoing.to_hash
    end
    self.perform_deliveries = true
    self.raise_delivery_errors = true
    self.default_charset = "utf-8"

    def template_path
      if self.class.tool_name.nil?
        raise RuntimeError, "The tool_name has not been set, " +
          "and no default tool can be determined."
      else
        class_name = self.class.name.split("::").last
        return I3.resource("#{self.class.tool_name}/data/templates/#{class_name}")
      end #if
    end #def
  
  end #class
  
  #
  # Class: I3::IMAPConnection
  #
  # Base class for connecting to the IMAP server
  #
  class IMAPConnection
    include I3::LoggingSupport
    
    REQUIRED_KEYS = [ :server, :port, :ssl, :username, :password ]
    
    #
    # Private Method: I3::IMAPConnection.new
    #
    # Parameters:
    #   connection - a Net::IMAP object
    #
    def initialize(connection)
      @connection = connection
    end #initialize

    #
    # Class Method: connect
    #
    # Connects to an IMAP server and returns an initialized `IMAPConnection`
    # object.
    #
    # The `options` hash recognizes the following key/value
    # pairs:
    #
    #   * `:server`   - required; the host to connect to
    #   * `:port`     - required; the port to connect on.
    #   * `:ssl`      - required; `true` if you want to use SSL, `false` to transmit in plain text
    #   * `:username` - required; the account name of the mailbox you want
    #   * `:password` - required; the password for the given account name
    #   * `:folder`   - optional; the folder to read from.  Defaults to `inbox`.
    #
    # Be sure to close the connection using <I3::IMAPConnection::close>
    # when you are finished using it.
    #
    # Parameters:
    #   options - the `Hash` of IMAP server options
    #
    # Returns:
    #   A new `I3::IMAPConnection` that is connected to the server.
    # 
    # Raises:
    #   An `ArgumentError` if the required arguments are not supplied.
    #
    def self.connect(options)
      
      REQUIRED_KEYS.each { |key| raise ArgumentError if options[key].nil? }

      # Fill in unspecified options
      options[:folder] = "inbox" if options[:folder].nil?
      
      # Create Net::IMAP connection
      conn = Net::IMAP.new(options[:server], options[:port], options[:ssl])
      conn.login(options[:username], options[:password])
      conn.select(options[:folder])

      # Instantiate IMAP class
      return IMAPConnection.new(conn)
      
    end #def
    
    #
    # Method: close
    #
    # Logs out of the IMAP server and closes the connection.
    #
    def close
      @connection.close         # Close the active mailbox
      @connection.logout        # Send the logout command
      @connection.disconnect    # Close the actual connection
    end #def
    
    #
    # Method: list_messages
    #
    # Retrieves the list of the messages in the currently selected mail
    # folder.
    #
    # Returns:
    #   An <I3::MessageList> providing the envelope data for each message.
    #
    def list_messages
      if @message_list.nil?
        @message_list = MessageList.new(@connection)
      end #if
      return @message_list
    end #def
    
    #
    # Method: get_message_by_uid
    #
    # Retrieves a full message from the server.  The message's unique
    # identifier (uid) is used to look up the message.
    #
    # Parameters:
    #   uid - the UID of the message to retrieve
    #
    # Returns:
    #   An <I3::Message> containing the message data.
    #
    def get_message_by_uid(uid)
      message = @connection.uid_fetch(uid.to_i, "RFC822")[0].attr["RFC822"]
      
      # mark this message as being seen
      @connection.uid_store(uid.to_i, "+FLAGS", [:Seen])
      
      # for some reason, the parser doesn't like the old line returns; strip 
      # them out
      return Message.receive(message.tr("\r", ""))
    end #def
    
  end #class
  
  #
  # Class: I3::MessageList
  #
  # Provides an interface to the list of messages for the current
  # working IMAP directory.
  #
  class MessageList
    include Enumerable
    include I3::LoggingSupport
    
    attr_bool_reader :is_cached
    
    #
    # Method: I3::MessageList.new
    #
    # Parameters:
    #   connection - a `Net::IMAP` connection object
    #
    def initialize(connection)
      @is_cached = false
      @connection = connection
      cache_list
    end #def
    
    private
      
      #
      # Private Method: cache_list
      #
      # Ensures that the message list has been cached.  The first time this
      # method is called, it loads the list of messages from the server.
      # Subsequent calls will have no effect.  The idea is that this method
      # can be called before operations that require the list, and the
      # list will be loaded on-demand.
      #
      # The `force_reload` parameter can be set to `true` to re-cache the
      # message list.
      #
      # Parameters:
      #   force_reload - optional; set to `true` to force loading of the
      #     message list.  Defaults to `false`.
      #
      def cache_list(force_reload=false)
        unless self.is_cached? or force_reload
          @messages = []
          
          # get the list of message id's and return an empty array if there 
          # are no messages in the box
          search = @connection.search("All")
          return if search.size == 0
          
          @raw_messages = @connection.fetch(search, 
              ["FLAGS", "INTERNALDATE", "RFC822.SIZE", "ENVELOPE", "UID"])
          @is_cached = true
          
          @raw_messages.each do |raw| 
            message = {
              "seqno"   => raw.seqno, 
              "uid"     => raw.attr["UID"], 
              "date"    => Time.parse(raw.attr["INTERNALDATE"]), 
              "subject" => raw.attr["ENVELOPE"].subject, 
              "flags"   => raw.attr["FLAGS"], 
              "size"    => raw.attr["RFC822.SIZE"]
            }

            ["to", "cc", "bcc", "from", "sender", "reply_to"].each do |a|
              message[a] = raw.attr["ENVELOPE"][a].collect { |address|
                {
                  "name"    => address.name, 
                  "address" => "#{address.mailbox}@#{address.host}", 
                  "user"    => address.mailbox.downcase, 
                  "domain"  => address.host.downcase
                }
              } unless raw.attr["ENVELOPE"][a].nil?
            end #do
            
            @messages.push(message)
          end #do
        end #unless 
      end #def
    
    public
    
      #
      # Method: size
      #
      # Returns the number of messages in the list
      #
      def size
        return @messages.size
      end #def
    
      #
      # Method: sort!
      #
      # Sorts the message list in-place by the supplied field.
      #
      # Parameters:
      #   field - the name of the field to sort on
      #   desc  - optional; `true` to sort in descending order
      #
      def sort!(field, desc=false)
        if desc
          @messages.sort! { |a, b| b[field] <=> a[field] }
        else
          @messages.sort! { |a, b| a[field] <=> b[field] }
        end #if
      end #def
    
      #
      # Method: to_shared
      #
      # Formats the message list data into objects that can be encoded
      # in JSON format for sending to the client.
      #
      # Returns:
      #   result - an array of JSON-compatible objects
      #
      def to_shared
        result = @messages
        result.each do |message|
          message["flags"] = message["flags"].inject(Hash.new) { |hash, value| 
            hash[value.id2name.downcase] = true
            hash
          }
        end #do
        return result
      end #def
      
  end #class
  
  #
  # Class: I3::Message
  #
  # Provides functionality for accessing an email message.
  #
  class Message < ActionMailer::Base
    include I3::LoggingSupport
    
    attr_reader :message
    
    private
    
      #
      # Private Method: assign_body_parts
      #
      # If the body of the message is a multipart message, loop through all 
      # the parts and build a hash of the different part types.  This is
      # called by the `receive` method.
      #
      # Parameters:
      #   body - the raw body of the message
      #
      def assign_body_parts(body)
        body.parts.each do |part|
          if part.multipart?
            assign_body_parts(part)
          else
            @body[part.header["content-type"].sub_type] = part.body if 
              part.header["content-type"].main_type == "text"
          end #if
        end #do
      end #def
      
    public
    
      #
      # Method (Hidden): receive
      #
      # Receives a raw message from the server and parses it (through TMail) 
      # into a usable Message object.  This is called by `ActionMailer::Base`
      # when its `receive` class method is called.
      #
      # Parameters:
      #   message - a `TMail::Mail` object
      #
      def receive(message)
        @message = message
        @body = Hash.new
        if @message.multipart?
          assign_body_parts(@message)
        else
          @body[@message.header["content-type"].sub_type] = @message.body if 
            @message.header["content-type"].main_type == "text"
        end #if
        return self
      end #def
      
      #
      # Method: header
      #
      # Returns the header for the message.
      #
      def header
        return @message.header
      end #def
    
      #
      # Method: body
      #
      # Returns the body of the message.
      #
      # Parameters:
      #   sub_type - optional; the text sub-type of the message body part that
      #     you want if the message is a multi-part message (e.g. "plain" for
      #     the "text/plain" part).  Defaults to "plain".
      #
      def body(sub_type="plain")
        return { "type" => sub_type, "content" => @body[sub_type] }
      end #def
    
  end #class
  
end #module