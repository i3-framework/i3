#
# File: documents/meta/jobs
# 
# Defines jobs to run on a regular basis.
# 
# Credits:
#   Written by Marshall Elfstrand (marshall@vengefulcow.com).
# 
# Copyright / License:
#   Copyright 2009 Mission Aviation Fellowship.
# 
# Version:
#   $Id: jobs.rb 66 2008-03-17 19:16:01Z nmellis $
# 

require "documents/data/include/document-file"
require "documents/data/include/uploaded-file"
require "fileutils"

every_hour do
  Dir["#{Documents::DocumentFile::DOC_LINK_PATH}/*"].each do |temp_dir|
    FileUtils.rm_r(temp_dir) if File.mtime(temp_dir) < 4.hours.ago
  end #each
end #every_hour

every_day do 
  Dir["#{Documents::UploadedFile::TEMP_FOLDER}/*"].each do |temp_file|
    FileUtils.rm(temp_file) if File.mtime(temp_file) < 8.hours.ago
  end #each
end #every_day