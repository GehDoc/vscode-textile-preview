#!/bin/bash
# Replace Markdown by Textile in vscode markdown tree

version=1.38.1
vscode="vscode-$version"

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
	echo "Processing tree of $dir"

	# TODO : don't use 'cd'
	# TODO : use ./tools/tmp/ as working dir
	warning "src processing disabled (see TODO)"
	return 0

	cd $dir
	if [ $? -ne 0 ]; then
	  fatal_error "cannot chdir $dir"
	fi

	elements=$2

	for element in $elements
	do
	  echo "- Processing element $element"
	  for file in $element
	  do
		echo " - Processing $file"

		sed -i -e "s/markdown/textile/g" "$file"
		sed -i -e "s/Markdown/Textile/g" "$file"
		sed -i -e "s/MDDocument/TextileDocument/g" "$file"
		# TODO: replace "'.md'" by "'.textile'" (file extension)
		# TODO : i18n, replace "Textile Language Features" by "Textile Live Preview"

		# move files named "markdown..."
		if echo $file | egrep -iq "markdown[a-z]+.ts$" ; then
			target="${file/markdown/textile}"
			mv $file $target
		fi
	  done
	done
}

function process_dir_i18n() {
	# Process : https://github.com/Microsoft/vscode-loc/blob/master/i18n/vscode-language-pack-fr/translations/extensions/markdown-language-features.i18n.json
	dir=$1
	out_dir=$2

	echo "Processing tree of $dir to $out_dir"
	if [ ! -d "$dir" ]; then
	  fatal_error "$dir doesn't exist"
	fi

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
	fi
}


# -----------
echo "Processing src $vscode"

# TODO : download from github : https://github.com/Microsoft/vscode

process_dir_src "../$vscode/extensions/markdown-language-features/" './src/*.ts ./src/*/*.ts ./media/*.js ./package.json ./package.nls.json ./preview-src/*.ts ./schemas/package.schema.json'

# -----------
echo "Processing locales"

# Download from github : https://github.com/Microsoft/vscode-loc.git
OLD_PWD=`pwd`
cd ./tools/tmp/
if [ -d ./vscode-loc ]; then
	cd vscode-loc
	git pull
else
	git clone https://github.com/Microsoft/vscode-loc.git
fi
cd $OLD_PWD

process_dir_i18n ./tools/tmp/vscode-loc/i18n/ ./tools/tmp/out/i18n/

exit 0