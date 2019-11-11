#!/bin/bash
#
# Replace Markdown by Textile in vscode markdown tree.
# vscode and vscode-loc are fecthed from their GitHub repo, into ./tools/tmp/
# Then, all needed files are processed and copied to ./tools/tmp/out/

VSCODE_VERSION_GIT_TAG=1.40.0

function fatal_error() {
	msg=$1
	echo -e "\e[01;31mERR:\e[0m $1"
	exit -1
}

function warning() {
	msg=$1
	echo -e "\e[01;31mWRN:\e[0m $1"
}

function process_dir_src() {
	dir=$1
	out_dir=$2
	elements=$3

	OLD_DIR=`pwd`
	DEST_DIR=$OLD_DIR/$out_dir

	# unsafe
	rm -rf $out_dir
	mkdir -p $out_dir
	echo `pwd`
	if [ $? -ne 0 ]; then
		fatal_error "cannot mkdir $out_dir"
	fi

	echo "Processing tree of $dir to $out_dir"
	if [ ! -d "$dir" ]; then
		fatal_error "$dir doesn't exist"
	fi
	# After this line, don't forget to `cd $OLD_DIR` before leaving function, and use $DEST_DIR instead of $out_dir
	cd $dir

	processed=0
	for file in $elements; do
		echo " - Processing $file"

		# files will be copied to $DEST_DIR
		mkdir -p $DEST_DIR/$(dirname ${file})
	
		extension="${file##*.}"
		if [ "$extension" = "js" ] || [ "$extension" = "json" ] || [ "$extension" = "ts" ] || [ "$extension" = "css" ]; then
			# replace markdown by textile
			sed -e "s/markdown/textile/g" $file > $DEST_DIR/$file
			sed -i -e "s/Markdown/Textile/g" $DEST_DIR/$file
			sed -i -e "s/MDDocument/TextileDocument/g" $DEST_DIR/$file
			sed -i -e "s/'.md'/'.textile'/g" $DEST_DIR/$file
			sed -i -e 's/`.md`/`.textile`/g' $DEST_DIR/$file
		else
			# just copy other kind of files
			cp $file $DEST_DIR/$file
		fi

		# rename files named "markdown..." to "textile..."
		if echo $file | egrep -iq "markdown[a-z]*.[a-z]+$" ; then
			target="${file/markdown/textile}"
			mv $DEST_DIR/$file $DEST_DIR/$target
		fi

		let processed++
	done

	cd $OLD_DIR

	if [ $processed -eq 0 ]; then
		fatal_error "Nothing done"
	else
		echo " -> $processed files processed"
	fi
}

function process_dir_i18n() {
	# Process : https://github.com/Microsoft/vscode-loc/blob/master/i18n/vscode-language-pack-fr/translations/extensions/markdown-language-features.i18n.json
	dir=$1
	out_dir=$2

	echo "Processing tree of $dir to $out_dir"
	if [ ! -d "$dir" ]; then
		fatal_error "$dir doesn't exist"
	fi

	# unsafe
	rm -rf $out_dir
	mkdir -p $out_dir
	if [ $? -ne 0 ]; then
		fatal_error "cannot mkdir $out_dir"
	fi

	processed=0
	for file in $dir/vscode-language-pack-*/translations/extensions/markdown-language-features.i18n.json; do
		echo " - Processing $file"

		lang=${file%/translations/extensions/markdown-language-features.i18n.json}
		lang=${lang#$dir/vscode-language-pack-}

		./tools/split_i18n_bundle.js $lang $file $out_dir
		if [ $? -eq 0 ]; then
			let processed++
		else
			fatal_error "Error"
		fi
	done
	if [ $processed -eq 0 ]; then
		fatal_error "Nothing done"
	else
		echo " -> $processed files processed"
	fi
}

function github_DL() {
	package=$1
	OLD_PWD=`pwd`
	cd ./tools/tmp/
	if [ -d "$package" ]; then
		cd "$package"
		git fetch
	else
		git clone "https://github.com/Microsoft/$package.git"
	fi
	if [ $? -ne 0 ]; then
		fatal_error "cannot fetch $package"
	fi
	# Checkout to specific tag
	if [ ! -z "$2" ]; then
		git checkout tags/$2
	else
		git pull
	fi
	if [ $? -ne 0 ]; then
		fatal_error "cannot update $package"
	fi
	cd $OLD_PWD
}

# -----------
echo "Processing src"

# Download from github : https://github.com/Microsoft/vscode
github_DL "vscode" $VSCODE_VERSION_GIT_TAG

process_dir_src ./tools/tmp/vscode/extensions/markdown-language-features ./tools/tmp/out/ './src/*.* ./src/*/*.* ./media/*.* ./*.json ./*.js ./preview-src/*.* ./schemas/package.schema.json'


# -----------
echo "Processing locales"

# Download from github : https://github.com/Microsoft/vscode-loc.git
github_DL "vscode-loc"

process_dir_i18n ./tools/tmp/vscode-loc/i18n/ ./tools/tmp/out/i18n/

exit 0