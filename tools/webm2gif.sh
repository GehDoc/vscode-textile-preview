#!/bin/bash
# Transform WEBM screencast into GIF

. $(dirname $0)/log.sh


file=$1
if [ -z "$file" ]
then
	fatal_error "Use input filename as first argument"
fi
reducedname="/tmp/"$(basename "$file")".reduced.webm"
palettename="/tmp/"$(basename "$file")".png"


# 3840x2160 -> crop top+bottom bars -> scale to 1280x~720 (keep ar), 10 fps
ffmpeg -y -i "$file" -filter:v "crop=iw:ih-120:0:53,scale=1280:-2" -r 10 "$reducedname"
ffmpeg -y -i "$reducedname" -vf palettegen "$palettename"
ffmpeg -y -i "$reducedname" -i "$palettename" -filter_complex paletteuse -r 10 "$file.gif"
rm "$palettename" "$reducedname"