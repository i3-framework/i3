#
# File: framework/intranet/attributes
#
# Ruby provides built-in "attribute" methods (`attr_reader`, `attr_writer`,
# and so on) that automatically create methods to access member variables,
# making the creation of publicly-accessible properties much easier.  Ruby
# also has a convention of naming boolean properties (those that only return
# either `true` or `false`) with a question mark at the end (e.g.
# `String#empty?`).
#
# Sadly, when one attempts to use the attribute methods for creating
# properties with this naming convention, one finds that the member variable
# cannot be set, because the syntax `@variable? = value` is not allowed.
#
# These additional attributes make it possible to create boolean properties,
# where the reader ends with a question mark, and the writer does not.  This
# preserves both the question-mark convention and the attribute convention.
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
#   $Id: attributes.rb 2 2007-12-06 00:18:23Z melfstrand $
#

#
# Class: Module
#
# Makes additional attribute methods available to all class definitions.
#
class Module

  #
  # Method: attr_bool_reader
  #
  # Creates boolean reader methods for the given `symbols`.
  #
  # Example:
  # (start example)
  #   class BooleanReader
  #     attr_bool_reader :insane
  #     def initialize
  #       @insane = true
  #     end
  #   end
  #
  #   reader = BooleanReader.new
  #   reader.insane?  # => true
  # (end example)
  #
  def attr_bool_reader *symbols
    attr_reader *symbols
    symbols.each { |sym| alias_method "#{sym}?", sym }
    remove_method *symbols
  end #def


  #
  # Method: attr_bool_writer
  #
  # Creates boolean writer methods for the given `symbols`.
  # This is just a wrapper for `attr_writer`, since we don't
  # need any special behavior here.
  #
  # Example:
  # (start example)
  #   class BooleanWriter
  #     attr_bool_writer :crazy
  #     def initialize
  #       @crazy = false
  #     end
  #   end
  #
  #   writer = BooleanWriter.new
  #   writer.crazy = true
  # (end example)
  #
  def attr_bool_writer *symbols
    attr_writer *symbols
  end #def


  #
  # Method: attr_bool_accessor
  #
  # Creates boolean accessor methods for the given `symbols`.
  #
  # Example:
  # (start example)
  #   class BooleanAccessor
  #     attr_bool_accessor :utterly_mad
  #     def initialize
  #       @utterly_mad = false
  #     end
  #   end
  #
  #   accessor = BooleanAccessor.new
  #   accessor.utterly_mad?  # false
  #   accessor.utterly_mad = true
  #   accessor.utterly_mad?  # true
  # (end example)
  #
  def attr_bool_accessor *symbols
    attr_accessor *symbols
    symbols.each { |sym| alias_method "#{sym}?", sym }
    remove_method *symbols
  end #def

end #class