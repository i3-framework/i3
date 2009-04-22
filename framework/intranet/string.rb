#
# File: framework/intranet/string
#
# Adds helper methods to the Ruby `String` class.
#
# While Ruby's `String` class is incredibly flexible by itself, there are a
# few additional methods that would be nice to have on every `String` in order
# to improve readability.  This file adds some methods that can be called on
# Strings everywhere:
#
# (start example)
#   str = "Noon Siesta: Close Eyes"
#   str.starts_with?("No")  # => true
#   str.ends_with?("yes")   # => true
#   str.to_permalink        # => "noon-siesta-close-eyes"
# (end example)
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
#   $Id: string.rb 2 2007-12-06 00:18:23Z melfstrand $
#

# Set character encoding to UTF-8
$KCODE = "u"

require "jcode"                           # Basic multi-byte character support 
require "iconv"                           # Character encoding conversion

#
# Class: String
#
# Extensions to the Ruby `String` class.
#
class String

  #
  # Method: starts_with?
  #
  # Determines if the string starts with the given string or character.
  #
  # Parameters:
  #   str - the string or character to check this string against
  #
  # Returns:
  #   `true` if this string starts with the given value.
  #
  def starts_with?(str)
    str = str.chr if str.instance_of? Fixnum
    return (self[0...str.size] == str)
  end #def
  
  #
  # Method: ends_with?
  #
  # Determines if the string ends with the given string or character.
  #
  # Parameters:
  #   str - the string or character to check this string against
  #
  # Returns:
  #   `true` if this string ends with the given value.
  #
  def ends_with?(str)
    str = str.chr if str.instance_of? Fixnum
    return (self[-str.size..-1] == str)
  end #def

  #
  # Method: unescape_unicode
  # 
  # Converts "\uxxxx"-style encodings for Unicode characters into the
  # UTF-8 encoded characters that Ruby expects.  This is particularly
  # useful for parsing the JSON data sent by JavaScript.
  # 
  # Returns:
  #   The unescaped string.
  # 
  def unescape_unicode
    converter = Iconv.new("utf-8", "utf-16")
    self.gsub(/\\u[a-zA-Z0-9]{4}/) do |char_code|
      converter.iconv([char_code[2, 2].to_i(16).chr,
                       char_code[4, 2].to_i(16).chr].join)
    end #gsub
  end #def

  #
  # Method: to_ascii
  #
  # Transliterates non-ASCII characters into their ASCII equivalents.
  # This is particularly useful for English text that contains Unicode
  # characters like smart quotes.  Character modifiers like accents
  # will appear before the character (e.g. "é" becomes "'e").
  #
  # Returns:
  #   The ASCII-transliterated string.
  #
  def to_ascii
    Iconv.new('us-ascii//IGNORE//TRANSLIT', 'utf-8').iconv(self)
  end #def

  #
  # Method: to_permalink
  #
  # Creates a version of the string suitable for permalinking.
  # The string will be converted to lowercase, with all spaces and
  # special characters replaced by hyphens.
  #
  # Returns:
  #   The formatted string.
  #
  def to_permalink
    return self.downcase.gsub(/[^a-z0-9]+/, " ").strip.gsub(" ", "-")
  end #def

end #class
