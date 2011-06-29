/*
  Copyright (c) 2010  Seneca College
  MIT LICENSE
*/
/**
  @class This parser parses .PSI filetypes. These files are Arius3D
  proprietary files which have their data stored as a mixture of
  ASCII and binary data.
  
  If the hps0 files have normals, there will be
  
  - 3 bytes for X
  - 3 bytes for Y
  - 3 bytes for Z
  
  - 1 byte for Red
  - 1 byte for Green
  - 1 byte for Blue
  
  If the hps0 files do NOT have normals, there will be
  
  - 2 bytes for X
  - 2 bytes for Y
  - 2 bytes for Z
  
  - 2 bytes for Red, Green and Blue
  
<pre>
  <xml tags>
  <that have relevant>
  <information= about the file>
  Binary Data...
  (3 bytes for x, 3 bytes for y, 3 bytes for z and 3 bytes for rgb)
  ...
  ...
  ...
  ...
  location and color data end for points
  normal data start
  (every 3 bytes is compressed normal data)
  ...
  ...
  ...
  <more tags>
  <to close opening tags>
  <and provide more information>
</pre>

  @version:  0.7
  @author:   Mickael Medel
            asydik.wordpress.com
            Andor Salga
            asalga.wordpress.com
            
  Created:  February 2011
  Updated:  June 2011
*/
var PSIParser = (function() {

  /**
    @private
  */
  function PSIParser(config) {
  
    // Declare tags
    var bgnDocument   = "<PsDocument>",
        endDocument   = "</PsDocument>",
        bgnComposite  = "<PsComposite>",
        endComposite  = "</PsComposite>",
        bgnSubject    = "<PsSubject",
        endSubject    = "</PsSubject>",
        bgnInstance   = "<PsInstance>",
        endInstance   = "</PsInstance>",
        bgnEnv        = "<PsEnvironment>",
        endEnv        = "</PsEnvironment>",
        bgnName       = "<Name>",
        endName       = "</Name>",
        intMatIdStr   = "<Identity>",       // Internal Matrix Identity
        extMatIdStr   = "<ExtIdentity>";    // External Matrix Identity

    var bgnCompList       = "<PsList>",
        endCompList       = "</PsList>",
        compositeModelStr = "CompositeModel:",
        instanceModelStr  = "InstanceModel:",
        nurbSurfaceStr    = "NurbSurface",
        nurbCurveStr      = "NurbCurve",
        lineModelStr      = "LineModel",
        quadMeshStr       = "QuadMeshModel",
        triMeshStr        = "TriMeshModel",
        cloudModelStr     = "CloudModel",
        imgCloudModelStr  = "ImageCloudModel",
        txtObjStr         = "TextObject",
        imgObjStr         = "ImageObject",
        soundObjStr       = "SoundObject",
        octTreeModelStr   = "OctTreeModel",
        openBracket       = "<",
        closeBracket      = ">",
        slashEndMark      = "/",
        psPrefix          = "Ps";

    // Shuffle Config Variable Strings
    var bgnShuffle      = "<Shuffle>",
        endShuffle      = "<\\Shuffle>",
        bgnTempLight    = "<PsTempLight>",
        endTempLight    = "<\\PsTempLight>",
        bgnTempLightVec = "<PsTempLightVec>",
        endTempLightVec = "<\\PsTempLightVec>",
        bgnGlblAmbLight = "<PsGlobalAmbientLight>",
        endGlblAmbLight = "<\\PsGlobalAmbientLight>",
        bgnLightType    = "<PsLightType>",
        endLightType    = "<\\PsLightType>";

    // Environment Variable Strings - <PsEnvironment>
    var posDataStr  = "XYZData=",
        colDataStr  = "RGBData=",
        normDataStr = "IJKData=",
        fileTypeStr = "FileType=",
        compStr     = "Compression=",
        encStr      = "Encryption=",
        wtrMrkStr   = "WaterMark=",
        lenUnitStr  = "LengthUnit=";

    // View Variable Strings
    var bgnViewDef  = "<PointStream_View_Definition>",
        endViewDef  = "</PointStream_View_Definition>",
        quartStr    = "<Q",       // Quarternion Matrix
        pivotStr    = "<P",       // Pivot
        transStr    = "<T",       // Translation
        angStr      = "<A",       // FOV Angle
        scrnSizeStr = "<S",       // Screen Size
        bgColStr    = "<B",       // Background Color
        cv1Str      = "<Cv1";

    // Material Variable Strings
    var bgnTemp1Mat = "<PsTemp1Material>",
        endTemp1Mat = "<\\PsTemp1Material>";

    // Parent Variable Strings
    var bgnParentTag = "<PsParent= '";
        endParentTag = "'>";

    // PsSubject Variables Strings
    var selStr  = "Sel=",
        visStr  = "Vis=",
        lockStr = "Lok=",
        actStr  = "Act=";

    // Token Model Variable Strings
    var bgnLineModel    = "<PsLineModel>",
        bgnCloudModel   = "<PsCloudModel>",
        bgnImgCldModel  = "<PsImageCloudModel>",
        bgnTriMeshModel = "<PsTriMeshModel>",
        bgnNurbCurve    = "<PsNurbCurve>",
        bgnNurbSurface  = "<PsNurbSurface>",
        bgnTextObject   = "<PsTextObject>",
        bgnImageObject  = "<PsImageObject>",
        bgnSoundObject  = "<PsSoundObject>",
        bgnOctTreeModel = "<PsOctTreeModel>";

    // Level of Detail Variable Strings
    var numLvlStr   = "<NumLevels=",
        scnMatStr   = "<ScanMatrix:",
        bgnLvlStr   = "<Level=",
        endLvlStr   = "</Level=",
        binCloudStr = "<BinaryCloud>",
        ascCloudStr = "<AsciiCloud>",
        fmtStr      = "<Format=",
        formatTag   = "<Format=";

    var numPtStr  = "<NumPoints=",
        sptSzStr  = "<SpotSize=",
        posMinStr = "<Min=",
        posMaxStr = "<Max=",
        endXMLStr = ">";
    
    var undef;
    
    var __empty_func = function(){};
  
    var start = config.start || __empty_func;
    var parse = config.parse || __empty_func;
    var end = config.end || __empty_func;
    
    var version = "0.6";
    
    const UNKNOWN = -1;
    const XHR_DONE = 4;
    const STARTED = 1;

    var pathToFile = null;
    var fileSize = 0;
    
    //
    var numParsedPoints = 0;
    var numTotalPoints = 0;
    var progress = 0;
    
    //
    var numValuesPerLine = -1;
    var normalsPresent = false;
    var colorsPresent = true;
    var layoutCode = UNKNOWN;
    
    // Length of the arrays we'll be sending the library.
    var BUFFER_SIZE = 30000;
    
    //
    var tempBufferV;
    var tempBufferOffsetV = 0;

    var tempBufferC;
    var tempBufferOffsetC = 0;

    var tempBufferN;
    var tempBufferOffsetN = 0;

    //
    var parsedVerts = [];
    var parsedCols = [];
    var parsedNorms = [];
    
    var firstRun = true;
    
    // If the PSI file has normals, this will be true.
    var hasNormals = false;

    // If the PSI file has normals, we'll have 9 bytes for XYZ
    // and 3 for RGB.
    // If the PSI does NOT have normals, we'll have 6 bytes for XYZ
    // and 2 for RGB.
    // So when we're streaming in the bytes, we'll need to know what
    // parts are the vertices and which parts are the colors.
    //
    // Therefore this will either be 12 or 8.
    var byteIncrement;
    
    // These will be 0, 3 and 6 respectively if we have normals.
    // These will be 0, 2 and 4 respectively if we do NOT have normals.
    var xOffset;
    var yOffset;
    var zOffset;
    
    // values to be used in decompression of PSI
    var diffX, diffY, diffZ;
    var scaleX, scaleY, scaleZ;
    const SFACTOR = Math.pow(2, 24);
    const NFACTOR = -0.5 + Math.pow(2, 10);
    
    //
    var bgnTag = "";
    var endTag = "";
    var tagExists;
    var endTagExists;
    
    // keep track if onprogress event handler was called to 
    // handle Chrome/WebKit vs. Firefox differences.
    //
    // Firefox will call onprogress zero or many times
    // Chrome/WebKit will call onprogress one or many times
    var onProgressCalled = false;
    var AJAX = null;
    
    /**
      @private
      
      Functions to deal with specific bytes in the stream
      
      @returns normalized value of byte
    */
    var getByteAt = function(str, iOffset){
      return str.charCodeAt(iOffset) & 0xFF;
    };
      
    /**
      @private
      
      @param {String} str
      @param {Number} iOffset - Must be an int.
      
      @returns
    */
    var getXYZ = function(str, iOffset){
      return (((getByteAt(str, iOffset + 2) << 8) + getByteAt(str, iOffset + 1)) << 8) + getByteAt(str, iOffset);
    };
        
    /**
      @private
      
      This function takes in a variable length array and chops it into
      equal sized parts since the library requires the array of attributes
      to be of equal size.
      
      Any excess values which don't entirely fit into the buffers created will
      be returned along with their length so the next iteration can fill them 
      up from there.
      
      @param {} arr
      @param {} tempBuffer
      @param {} tempBufferOffset
      @param {} Which attribute are we sending in? 1 = vertex, 2 = color, 3 = normal
      
      @returns {Object}
    */
    var partitionArray = function(arr, tempBuffer, tempBufferOffset, AttribID){
      // If we don't have enough for one buffer, just add it and wait for the next call.
      if(arr.length + tempBufferOffset < BUFFER_SIZE){
        // if this is the start of a new buffer
        if(!tempBuffer){
          tempBuffer = new Float32Array(BUFFER_SIZE);
          tempBuffer.set(arr);
        }
        // If the buffer already exists, we're going to be adding to it. Don't worry about
        // over filling the buffer since we already know at this point that won't happen.
        else{
          tempBuffer.set(arr, tempBufferOffset);
        }
        tempBufferOffset += arr.length;
      }
   
      // If what we have in the temp buffer and what we just parsed is too large for one buffer
      else if(arr.length + tempBufferOffset >= BUFFER_SIZE){
      
        // if temp buffer offset is zero, Find out how many buffers we can fill up with this set of vertices
        var counter = 0;
        var numBuffersToFill = parseInt(arr.length/BUFFER_SIZE);
      
        // If there is something already in the buffer, fill up the rest.
        if(tempBufferOffset > 0){
          // Add the vertices from the last offset to however much we need to fill the temp buffer.
          var amtToFill = BUFFER_SIZE - tempBufferOffset;
          tempBuffer.set(arr.subarray(0, amtToFill), tempBufferOffset);
          
          switch(AttribID){
            case 1: numParsedPoints += BUFFER_SIZE/3;
                    parse(AJAX.parser, {"ps_Vertex": tempBuffer});break;
            case 2: parse(AJAX.parser, {"ps_Color":  tempBuffer});break;
            case 3: parse(AJAX.parser, {"ps_Normal": tempBuffer});break;
          }
          
          // now find out how many other buffers we can fill
          numBuffersToFill = parseInt((arr.length - amtToFill)/BUFFER_SIZE);
          counter = amtToFill;
        }
        
        // Create and send as many buffers as we can with
        // this chunk of data.
        for(var buffIter = 0; buffIter < numBuffersToFill; buffIter++){
          var buffer = new Float32Array(BUFFER_SIZE);
          
          buffer.set(arr.subarray(counter, counter + BUFFER_SIZE));
 
          switch(AttribID){                    
            case 1: numParsedPoints += BUFFER_SIZE/3;
                    parse(AJAX.parser, {"ps_Vertex": buffer});break;
            case 2: parse(AJAX.parser, {"ps_Color":  buffer});break;
            case 3: parse(AJAX.parser, {"ps_Normal": buffer});break;
          }
          
          counter += BUFFER_SIZE;
        }
        
        // put the end of the attributes in the first part of the temp buffer
        tempBuffer = new Float32Array(BUFFER_SIZE);
        tempBuffer.set(arr.subarray(counter, counter + arr.length));
        tempBufferOffset = arr.length - counter;
      }
      
      // return the changes
      return {
        buffer: tempBuffer,
        offset: tempBufferOffset
      };
    }
    
    /**
      Returns the version of this parser
      @name PSIParser#version
      @returns {String} parser version
    */
    this.__defineGetter__("version", function(){
      return version;
    });
    
    /**
      Get the number of parsed points so far
      @name PSIParser#numParsedPoints
      @returns {Number} number of points parsed.
    */
    this.__defineGetter__("numParsedPoints", function(){
      return numParsedPoints;
    });
    
    /**
      Get the total number of points in the point cloud.
      @name PSIParser#numTotalPoints
      @returns {Number}
    */
    this.__defineGetter__("numTotalPoints", function(){
      return numTotalPoints;
    });
    
    /**
      Returns the progress of downloading the point cloud
      @name PSIParser#progress
      @returns {Number} value from zero to one or -1 if unknown.
    */
    this.__defineGetter__("progress", function(){
      return progress;
    });
    
    /**
      Returns the file size of the resource in bytes.
      @name PSIParser#fileSize
      @returns {Number} size of resource in bytes.
    */
    this.__defineGetter__("fileSize", function(){
      return fileSize;
    });
    
    /**
      Stop downloading and parsing the associated point cloud.
    */
    this.stop = function(){
      if(AJAX){
        AJAX.abort();
      }
    };
    
    /**
      @param {String} pathToFile
    */
    this.load = function(path){
      pathToFile = path;

      AJAX = new XMLHttpRequest();
      AJAX.startOfNextChunk = 0;
      AJAX.last12Index = 0;
      
      // put a reference to the parser in the AJAX object
      // so we can give the library a reference to the
      // parser within the AJAX event handler scope.
      // !! eventually need to fix this
      AJAX.parser = this;

      /**
        @private
        Occurs exactly once when the resource begins to be downloaded.
      */
      AJAX.onloadstart = function(evt){
        start(AJAX.parser);
      };
      
      /*
       
      */
      AJAX.parseVertsCols = function(chunk, numBytes, byteIdx, verts, cols){
        for(var point = 0; point < numBytes/byteIncrement; byteIdx += byteIncrement, point++){
          verts[point*3 + 0] = (diffX * getXYZ(chunk, byteIdx    )) / scaleX;
          verts[point*3 + 1] = (diffY * getXYZ(chunk, byteIdx + yOffset)) / scaleY;
          verts[point*3 + 2] = (diffZ * getXYZ(chunk, byteIdx + zOffset)) / scaleZ;
          
          // If the PSI file has normals, there are 1 byte for each component.
          if(hasNormals){
            cols[point*3 + 0] = getByteAt(chunk, byteIdx +  9) / 255;
            cols[point*3 + 1] = getByteAt(chunk, byteIdx + 10) / 255;
            cols[point*3 + 2] = getByteAt(chunk, byteIdx + 11) / 255;
          }
          else{
            var byte1 = getByteAt(chunk, byteIdx + 6);
            var byte2 = getByteAt(chunk, byteIdx + 7);
            
            var b1 = (byte1<<3) & 0x08; // 2 bits
            var b2 = (byte2>>5) & 0x01; // 3 bits
            var byte3 = b2;
            
            cols[point*3 +0] = (((byte1>>2) & 0x1F) << 3)/255;
            cols[point*3 +1] = (((byte3) & 0x1F) << 1)/255;                        
            cols[point*3 +2] = (((byte2) & 0x1F) << 3)/255;
                      
          /*
            var byte1 = getByteAt(chunk, byteIdx + 6);
            var byte2 = getByteAt(chunk, byteIdx + 7);
            
            // cols[point*3 + 1] = ((b & 0x1F) << 3) /255;
            // cols[point*3 + 0] = (((byte1>>2) & 0x1F) << 3) /255;
            
            var b1 = (byte1<<3) & 0x18;
            var b2 = (byte2>>>5) & 0x07;
            
            var byte3 = b1 + b2;
            
            //  cols[point*3 + 0] = (((byte1>>2) & 0x00001F) << 3) /255;
            cols[point*3 + 0] = 0.5;
            cols[point*3 + 1] = (byte3 & 0x1f) /255;
            cols[point*3 + 2] = ((byte2 & 0x1F) << 3) /255;
            
           // cols[point*3 + 0] = (((byte1>>2) & 0x1F) << 3) /255;
           // cols[point*3 + 2] = ((byte2 & 0x1F) << 3) /255;      */      
          }
        }
      };
      
      /*
        @param {String} chunk
        @param {Number} numBytes
        @param {Number} byteIdx
        @param {ArrayBuffer} norms
      */
      AJAX.parseNorms = function(chunk, numBytes, byteIdx, norms){
        var nzsign, nx11bits, ny11bits, ivalue;
        var nvec = new Float32Array(3);
        
        // Start reading the normals where we left off reading the
        // vertex positions and colors.
        // Each normal is 3 bytes.
        for(var point = 0; byteIdx < numBytes; byteIdx += 3, point += 3){

          ivalue = getXYZ(chunk, byteIdx);
          nzsign =   (ivalue >> 22) & 0x0001;
          nx11bits = (ivalue) & 0x07ff;
          ny11bits = (ivalue >> 11) & 0x07ff;
          
          if(nx11bits >= 0 && nx11bits < 2048 && ny11bits >= 0 && ny11bits < 2048){

            nvec[0] = (nx11bits/NFACTOR) - 1.0;
            nvec[1] = (ny11bits/NFACTOR) - 1.0;
            
            var nxnymag = nvec[0]*nvec[0] + nvec[1]*nvec[1];
            
            // Clamp values.
            nxnymag = Math.min(nxnymag, 1);
            nxnymag = Math.max(nxnymag,-1);
            nxnymag = 1 - nxnymag;
            
            nvec[2] = Math.sqrt(nxnymag);
            
            if (nzsign){
              nvec[2] = -nvec[2];
            }
            var dNorm = nvec[0]*nvec[0] + nvec[1]*nvec[1] + nvec[2]*nvec[2];
            
            dNorm = (dNorm > 0) ? Math.sqrt(dNorm) : 1;
            
            norms[point]   = nvec[0]/dNorm;
            norms[point+1] = nvec[1]/dNorm;
            norms[point+2] = nvec[2]/dNorm;
          }
        }
      };
      
      /*
        Occurs exactly once, when the file is done being downloaded.
        
        Firefox/Minefield sometimes skips calling onprogress and 
        jumps to onload.
        
        @param {} evt
      */
      AJAX.onload = function(evt){
      
        var textData = AJAX.responseText;
        var chunkLength = textData.length;
        
        // If we downloaded the file in one request.
        if(firstRun){
        
          // First, read in the important bounding box data.
          AJAX.firstLoad(textData);
          
          // first get the number of points in the cloud
          // <NumPoints= 11158 2 0 11158 0 0 >\r\n<Spot
          // <NumPoints= 11158 0 >
          
          // Find the start and end tags for NumPoints
          var numPointsTagIndex = textData.indexOf(numPtStr);
          var numPointsTagEndIndex = textData.indexOf(">", numPointsTagIndex+1);
         
          var numPointsContents = textData.substring(numPointsTagIndex, numPointsTagEndIndex+1);
          
          // Set the parser's attribute
          // Multiply by 1 to convert to a Number type
          // ["<NumPoints=", "11158", "0", ">"]
          numParsedPoints = numTotalPoints = numPointsContents.split(" ")[1] * 1;
          
          hasNormals = numPointsContents.split(" ")[2] * 1 == 0 ? false : true;

          // Read the position and color data

          // <Level=0>
          // <BinaryCloud>
          // <Format=1>
          // <NumPoints= 11158 0 >
          // <SpotSize= 0.134696 >
          // <Min= -24.1075 -28.9434 -16.8786 >
          // <Max= -12.4364 -14.8525 -18.72375 >
          // ...\
          // ... }- binary data (vertices & colors)
          // .../
          // ...\
          // ... }- possibly more binary data (normals)
          // .../
          // </Level=0>
          // </PsCloudModel>
          
          // Checks if begin or end tags can be found using regex.
          var tagExists = textData.indexOf(bgnTag);
          var infoEnd = textData.indexOf(endLvlStr);
          var infoStart;
          
          // If the bgnTag exists then set the startOfNextChunk
          // to the end of the bgnTag + 2 for offset values.
          if(tagExists !== -1){
            // +2 for offset values
            tagLen = bgnTag.length + 2;
            infoStart = tagExists + tagLen;
          }

          // This contains our raw binary data.
          var binData;
          
          if(hasNormals){
            binData = textData.substring(infoStart, infoEnd);
          }
          else{
            binData = textData.substring(infoStart-1, infoEnd-1);
          }
          
          var numBytes = binData.length;

          var verts = new Float32Array(numTotalPoints * 3);
          var cols  = new Float32Array(numTotalPoints * 3);
          AJAX.parseVertsCols(binData, numBytes, 0, verts, cols);

          // Parse the normals if we have them.
          var norms;
          if(hasNormals){
            norms = new Float32Array(numTotalPoints * 3);
            AJAX.parseNorms(binData, numBytes, numTotalPoints * byteIncrement, norms);
          }
          
          var attributes = {};
          if(verts){attributes["ps_Vertex"] = verts;}
          if(cols){ attributes["ps_Color"] = cols;}
          if(norms){attributes["ps_Normal"] = norms;}

          // Indicate parsing is done. Ranges from 0 to 1.
          progress = 1;
          parse(AJAX.parser, attributes);
          end(AJAX.parser);
          
          return;
        }
        
        // If we didn't get the entire file in one request, continue on...
        var infoEnd = textData.indexOf(endLvlStr);

        var chunk;

        // If the file has normals as indicated at the start of the file.
        if(hasNormals){
          normalsPresent = true;
          colorsPresent = false;
          chunk = textData.substring(AJAX.startOfNextChunk, infoEnd);
        }
        else{
          chunk = textData.substring(AJAX.startOfNextChunk-1, infoEnd-1);
        }
        
        AJAX.parseChunk(chunk);
      
        // Get the last remaining bits from the temp buffers
        // and parse those too.
        if(tempBufferV && tempBufferOffsetV > 0){
          // Only send the data if there's actually something to send.
          var lastBufferV = tempBufferV.subarray(0, tempBufferOffsetV);
          numParsedPoints += tempBufferOffsetV/3;
          parse(AJAX.parser, {"ps_Vertex": lastBufferV});
        }
        
        if(tempBufferC && tempBufferOffsetC > 0){
          // Only send the data if there's actually something to send.
          var lastBufferC = tempBufferC.subarray(0, tempBufferOffsetC);
          parse(AJAX.parser, {"ps_Color": lastBufferC});
        }
        
        if(tempBufferN && tempBufferOffsetN > 0){
          // Only send the data if there's actually something to send.
          var lastBufferN = tempBufferN.subarray(0, tempBufferOffsetN);
          parse(AJAX.parser, {"ps_Normal": lastBufferN});
        }

        progress = 1;
        
        end(AJAX.parser);
      }
      
      /**
        @private
      */
      AJAX.parseChunk = function(chunk){
      
        // !! Fix this.
        // This occurs over network connections, but not locally.
        if(chunk){
        
          var numVerts = chunk.length/byteIncrement;
          var numBytes = chunk.length;
          
          //
          var verts, cols, norms;
          
          // !!! COMMENT
          if(onProgressCalled === true){

            // !!! this needs to be changed.
            // if colors are present, we know we're still
            // dealing with vertices.
            if(numVerts > 0 && colorsPresent){
              // !!! only for debugging, remove on prduction
              if(numVerts !== Math.floor(numVerts)){
                console.log("invalid numVerts: " + numVerts);
                numVerts = Math.floor(numVerts);
              }
              verts = new Float32Array(numVerts * 3);
              cols = new Float32Array(numVerts * 3);
            }
            
            // parsing normal values, not sure the logic behind it (as it was never provided)
            // we take 3 bytes and apply some bit shifting operations on it
            // we then take the results and multiply it to some set values
            // the normals are the resulting values
            if(numBytes > 0 && normalsPresent){
            
              if(numBytes !== Math.floor(numBytes)){
                console.log('invalid num bytes');
              }
              norms = new Float32Array(numBytes);
              AJAX.parseNorms(chunk, numBytes, 0, norms);
            }
            // parsing xyz and rgb values, not sure behind the logic either
            // 3 bytes are used for each x, y, z values
            // each of the last 3 bytes of the 12 correspond to an rgb value
            else{
              var byteIdx = 0;
              AJAX.parseVertsCols(chunk, numBytes, byteIdx, verts, cols);
            }
          }

          if(verts){
            var o = partitionArray(verts, tempBufferV, tempBufferOffsetV, 1);
            tempBufferV = o.buffer;
            tempBufferOffsetV = o.offset;
          }
          if(cols){
            var o = partitionArray(cols, tempBufferC, tempBufferOffsetC, 2);
            tempBufferC = o.buffer;
            tempBufferOffsetC = o.offset;
          }
          if(norms){
            var o = partitionArray(norms, tempBufferN, tempBufferOffsetN, 3);
            tempBufferN = o.buffer;
            tempBufferOffsetN = o.offset;
          }
        }
      };
      
      /**
        @private
      */
      AJAX.firstLoad = function(textData){
        var temp;

        var xMax, xMin, yMax;
        var yMin, zMax, zMin;

        // numPtStr - number of points in the file
        tagExists = textData.indexOf(numPtStr);
        if(tagExists !== -1){
          endTagExists = textData.indexOf(endXMLStr, tagExists);
          temp = textData.substring((tagExists + numPtStr.length), endTagExists);
          var numPtArr = temp.split(" ");
          
          // Multiply by 1 to convert to a Number type.
          numTotalPoints = numPtArr[1] * 1;
          
          // We can find out if there are normals by inspecting <NumPoints>
          // <NumPoints= 6 1 >
          // <NumPoints= 6 2 >
          // If the second value is 0, the file does not contain normals.
          if((numPtArr[2] * 1) !== 0){
            hasNormals = true;
          }
        }
                
        // posMinStr - lowest value in the file (used for decompression)
        tagExists = textData.indexOf(posMinStr);
        
        if(tagExists !== -1){
          endTagExists = textData.indexOf(endXMLStr, tagExists);
          temp = textData.substring((tagExists + posMinStr.length), endTagExists);
          var posMinArr = temp.split(" ");
          
          // Multiply by 1 to convert to a Number type.
          xMin = posMinArr[1] * 1;
          yMin = posMinArr[2] * 1;
          zMin = posMinArr[3] * 1;
        }
        
        // posMaxStr - highest value in the file (used for decompression)
        tagExists = textData.indexOf(posMaxStr);

        if(tagExists !== -1){
          endTagExists = textData.indexOf(endXMLStr, tagExists);
          temp = textData.substring((tagExists + posMaxStr.length), endTagExists);
          var posMaxArr = temp.split(" ");
          
          // Multiply by 1 to convert to a Number type.
          xMax = posMaxArr[1] * 1;
          yMax = posMaxArr[2] * 1;
          zMax = posMaxArr[3] * 1;
          
          bgnTag = textData.substring(tagExists, (endTagExists + 1));
          
          diffX = xMax - xMin;
          diffY = yMax - yMin;
          diffZ = zMax - zMin;

          scaleX = SFACTOR + xMin;
          scaleY = SFACTOR + yMin;
          scaleZ = SFACTOR + zMin;
          
          // 9 for XYZ
          // 3 for RGB
          if(hasNormals){
            byteIncrement = 12;
            xOffset = 0;
            yOffset = 3;
            zOffset = 6;
          }
          else{
            // 6 for XYZ
            // 2 for RGB
            byteIncrement = 8;
            xOffset = 0;
            yOffset = 2;
            zOffset = 4;            
          }      
          
          // If we got this far, we can start parsing values and we don't
          // have to try running this function again.
          firstRun = false;
        }
        
        // There is a chance that in the first XHR request we didn't get 
        // as far as the <Max> tag. Since <Min> and <Max> are necessary to
        // read before parsing the file, force the PSI parser to wait for
        // the next request and try again.
        else{
          firstRun = true;
        }
      }
    
      /**
        @private
        
        On Firefox/Minefield, this will occur zero or many times
        On Chrome/WebKit this will occur one or many times
      */
      AJAX.onprogress = function(evt){
      
        // 
        onProgressCalled = true;
        
        // Update the file's progress.
        if(evt.lengthComputable){
          fileSize = evt.total;
          progress = evt.loaded/evt.total;
        }

        // If we have something to actually parse.
        if(AJAX.responseText){
          var textData = AJAX.responseText;
          var chunkLength = textData.length;
          
          // If this is the first call to onprogress.
          if(firstRun){
            AJAX.firstLoad(textData);
            // firstLoad() will have attempted to read at least the <Min> and <Max>
            // tags, if we aren't that far in the file, we'll need to try again
            if(firstRun){
              return;
            }
          }
          
          // Try to find the <Level> and </Level=0> tags which means we would
          // have all the data.
          endTag = endLvlStr;
          tagExists = textData.indexOf(bgnTag);
          var infoEnd = textData.indexOf(endTag);
          var infoStart;
          
          // If the bgnTag exists then set the startOfNextChunk
          // to the end of the bgnTag + 2 for offset values.
          if(tagExists !== -1){
            // +2 for offset values
            tagLen = bgnTag.length + 2;
            infoStart = tagExists + tagLen;
            if(AJAX.startOfNextChunk === 0){
              AJAX.startOfNextChunk = infoStart;
            }
          }
          
          // Find the last multiple of 12 in the chunk
          // this is because of the format shown at the top of this parser.
          var last12 = Math.floor((chunkLength - infoStart) / byteIncrement);
          AJAX.last12Index = (last12 * byteIncrement) + infoStart;
          
          // If the end tag was found.
          if(infoEnd !== -1){
          
            if(!hasNormals){
              AJAX.last12Index = infoEnd-1;
            }
            AJAX.last12Index = infoEnd;
          }
          
          var totalPointsInBytes = (numTotalPoints * byteIncrement) + infoStart;

          // Handles parsing up to the end of position and colors.
          // Sets the next chunk at the start of normals.
          if((totalPointsInBytes > AJAX.startOfNextChunk) && (totalPointsInBytes < AJAX.last12Index)){
            var chunk	= textData.substring(AJAX.startOfNextChunk, totalPointsInBytes);
            
            if(chunk.length > 0){
              AJAX.startOfNextChunk = totalPointsInBytes;
            	AJAX.parseChunk(chunk);
            }
          }
          
          // Parse the normals.
          else if((AJAX.last12Index > totalPointsInBytes) && (AJAX.startOfNextChunk >= totalPointsInBytes)){
            var chunk	= textData.substring(AJAX.startOfNextChunk, AJAX.last12Index);
            normalsPresent = true;
            colorsPresent = false;
                
            if(chunk.length > 0){
              AJAX.startOfNextChunk = AJAX.last12Index;
              AJAX.parseChunk(chunk);
            }
          }

          // Parse position and colors.
          else{
            var chunk;

            if(hasNormals){
              chunk = textData.substring(AJAX.startOfNextChunk, AJAX.last12Index);
            }
            else{
              chunk = textData.substring(AJAX.startOfNextChunk-1, AJAX.last12Index-1);              
            }
            
            // !! debug this
            if(chunk.length > 0){
              AJAX.startOfNextChunk = AJAX.last12Index;              
              if(hasNormals === false){
              //  AJAX.startOfNextChunk = AJAX.last12Index-1;
              }
              AJAX.parseChunk(chunk);
            }
            
          }
        }// AJAX.responseText
      };// onprogress
      
      // This line is required since we are parsing binary data.
      if(AJAX.overrideMimeType){
        AJAX.overrideMimeType('text/plain; charset=x-user-defined');
      }
      // open an asynchronous request to the path
      AJAX.open("GET", path, true);

      AJAX.send(null);
    };// load
  }// ctor
  return PSIParser;
}());
