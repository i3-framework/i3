
TextMate Extras
===============

The Bundles.zip file in this folder adds helpful features to TextMate for
intranet programming.  Unzip the archive and place the contents of the
Bundles folder in your ~/Library/Application Support/TextMate/Bundles folder.

The triggers included in the JavaScript and Ruby modules auto-create
the NaturalDocs comments for the generated module, class, etc.  Once
you type the trigger (e.g. "@m" and the tab key), you can tab between
the sections of the code and its documentation.

JavaScript features:
  * Syntax highlighting and function list support (where applicable)
    for Objective-JS (i.e. the @class, @method, @module, and @property
    directives).
  * Triggers:
    - @mod <tab> to create a new module
    - @c <tab> to create a new class
    - @m <tab> to create a new method
    - @p <tab> to create a new property
    - @pr <tab> to create a new property reader (get-only)
    - @pw <tab> to create a new property writer (set-only)
    
Ruby features:
  * Highlight a method or class name and press Ctrl-H to see the Ruby
    documentation (note that `ri` must be working on your system.)
  * Triggers:
    - mod <tab> to create a new module
    - c <tab> to create a new class
    - m <tab> to create a new method
    - cm <tab> to create a new class method

Rails features:
  * Files ending in .erb are recognized as RHTML format.

