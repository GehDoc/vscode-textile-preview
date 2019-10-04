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

# -----------
echo "Processing src $vscode"

# TODO : download from github

process_dir_src "../$vscode/extensions/markdown-language-features/" './src/*.ts ./src/*/*.ts ./media/*.js ./package.json ./package.nls.json ./preview-src/*.ts ./schemas/package.schema.json'

# -----------
echo "Processing locales"

# TODO :
fatal_error "TODO : i18n now on : https://github.com/Microsoft/vscode-loc/blob/master/i18n/vscode-language-pack-fr/translations/extensions/markdown-language-features.i18n.json"
# process_dir "../../../$vscode/i18n/fra/extensions/markdown-language-features/" './*.json ./out/*.json ./out/*/*.json'

exit 0