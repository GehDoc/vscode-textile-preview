#!/bin/bash
#
# Replace 'Markdown' by 'Textile' in VSCode Markdown Language Features tree.
# vscode and vscode-loc are fetched from their GitHub repo, into ./tools/tmp/
# Then, all needed files are processed and copied to ./tools/tmp/out/
#
# After running this tool, you can compare ./ and ./tools/tmp/out/ to gather
# new features.

VSCODE_VERSION_GIT_TAG=1.67.0

. $(dirname $0)/log.sh

function process_dir_src() {
	dir=$1
	out_dir=$2
	elements=$3

	OLD_DIR=`pwd`
	DEST_DIR=$OLD_DIR/$out_dir

	# unsafe
	rm -rf "$out_dir"
	mkdir -p "$out_dir"
	if [ $? -ne 0 ]; then
		fatal_error "cannot mkdir $out_dir"
	fi

	echo "Processing tree of $dir to $out_dir"
	if [ ! -d "$dir" ]; then
		fatal_error "$dir doesn't exist"
	fi
	# After this line, don't forget to `cd $OLD_DIR` before leaving function, and use $DEST_DIR instead of $out_dir
	cd "$dir"

	processed=0
	for file in $elements; do
		echo " - Processing $file"

		# files will be copied to $DEST_DIR with their directory
		# but, file from ../ will be copied at the root $DEST_DIR
		dirname=$(dirname "$file")
		if [ "$dirname" != ".." ]; then
			mkdir -p "$DEST_DIR/$dirname"
			destfile=$DEST_DIR/$file
		else
			destfile=$DEST_DIR/$(basename "$file")
		fi

		extension="${file##*.}"
		if [ "$extension" = "js" ] || [ "$extension" = "json" ] || [ "$extension" = "ts" ] || [ "$extension" = "css" ]; then
			# replace markdown by textile
			sed -e "s/markdown/textile/g" "$file" > "$destfile"
			sed -i -e "s/MarkdownIt/TextileJS/g" "$destfile"
			sed -i -e "s/Markdown/Textile/g" "$destfile"
			sed -i -e "s/MDDocument/TextileDocument/g" "$destfile"
			sed -i -e "s/MdReferencesProvider/TextileReferencesProvider/g" "$destfile"
			sed -i -e "s/MdDocumentSymbolProvider/TextileDocumentSymbolProvider/g" "$destfile"
			sed -i -e "s/MdLinkSource/TextileLinkSource/g" "$destfile"
			sed -i -e "s/MdInlineLink/TextileInlineLink/g" "$destfile"
			sed -i -e "s/MdLinkDefinition/TextileLinkDefinition/g" "$destfile"
			sed -i -e "s/MdLinkProvider/TextileLinkProvider/g" "$destfile"
			sed -i -e "s/MdLink/TextileLink/g" "$destfile"
			sed -i -e "s/MdWorkspaceContents/TextileWorkspaceContents/g" "$destfile"
			sed -i -e "s/MdWorkspaceSymbolProvider/TextileWorkspaceSymbolProvider/g" "$destfile"
			sed -i -e "s/MdPathCompletionProvider/TextilePathCompletionProvider/g" "$destfile"
			sed -i -e "s/MdFoldingProvider/TextileFoldingProvider/g" "$destfile"
			sed -i -e "s/MdWorkspaceCache/TextileWorkspaceCache/g" "$destfile"
			sed -i -e "s/dotMdResource/dotTextileResource/g" "$destfile"
			sed -i -e "s/tryFindMdDocumentForLink/tryFindTextileDocumentForLink/g" "$destfile"
			sed -i -e "s/MdHeaderReference/TextileHeaderReference/g" "$destfile"
			sed -i -e "s/MdReference/TextileReference/g" "$destfile"
			sed -i -e "s/MdFileRenameEdit/TextileFileRenameEdit/g" "$destfile"
			sed -i -e "s/MdWorkspaceEdit/TextileWorkspaceEdit/g" "$destfile"
			sed -i -e "s/MdRenameProvider/TextileRenameProvider/g" "$destfile"
			sed -i -e "s/MdSmartSelect/TextileSmartSelect/g" "$destfile"
			sed -i -e "s/'.md'/'.textile'/g" "$destfile"
			sed -i -e "s/ .md / .textile /g" "$destfile"
			sed -i -e "s/\*.md'/\*.textile'/g" "$destfile"
			sed -i -e 's/`.md`/`.textile`/g' "$destfile"
			sed -i -e "s/'doc.md'/'doc.textile'/g" "$destfile"
			sed -i -e "s/'other.md'/'other.textile'/g" "$destfile"
		else
			# just copy other kind of files
			cp "$file" "$destfile"
		fi

		# rename files named "markdown..." to "textile..."
		# don't bother with files from "../", there is no such case now
		if [ "$dirname" != ".." ]; then
			if echo "$file" | egrep -iq "markdown[a-z]*.[a-z]+$" ; then
				target="${file/markdown/textile}"

				if [ "$target" = "./media/textile.css" ]; then
					# main CSS file should be splitted in 2
					target_end="./media/textile-theming.css"
					{ sed -n '/body.wordWrap pre {/q;p'; cat > "$DEST_DIR/$target_end"; } <"$destfile" >"$DEST_DIR/$target"
					sed -i '1ibody.wordWrap pre {' "$DEST_DIR/$target_end"
					rm "$destfile"
				else
					mv "$destfile" "$DEST_DIR/$target"
				fi
			fi
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
	rm -rf "$out_dir"
	mkdir -p "$out_dir"
	if [ $? -ne 0 ]; then
		fatal_error "cannot mkdir $out_dir"
	fi

	processed=0
	for file in $dir/vscode-language-pack-*/translations/extensions/markdown-language-features.i18n.json; do
		echo " - Processing $file"

		lang=${file%/translations/extensions/markdown-language-features.i18n.json}
		lang=${lang#$dir/vscode-language-pack-}

		./tools/split_i18n_bundle.js "$lang" "$file" "$out_dir"
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
		if [ $? -ne 0 ]; then
			fatal_error "cannot fetch $package"
		fi
	else
		git clone "https://github.com/Microsoft/$package.git"
		if [ $? -ne 0 ]; then
			fatal_error "cannot clone $package"
		fi
		cd "$package"
	fi
	# Checkout to specific tag
	if [ ! -z "$2" ]; then
		git checkout "$2"
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
github_DL "vscode" tags/$VSCODE_VERSION_GIT_TAG

process_dir_src ./tools/tmp/vscode/extensions/markdown-language-features ./tools/tmp/out/  '../shared.webpack.config.js ../tsconfig.base.json ./src/*.* ./src/*/*.* ./media/*.* ./notebook/*.* ./.vscodeignore ./*.json ./*.js ./preview-src/*.* ./schemas/package.schema.json ./test-workspace/*.* ./test-workspace/*/*.*'


# -----------
echo "Processing locales"

# Download from github : https://github.com/Microsoft/vscode-loc.git
github_DL "vscode-loc" release/$VSCODE_VERSION_GIT_TAG

process_dir_i18n ./tools/tmp/vscode-loc/i18n/ ./tools/tmp/out/i18n/


# -----------
end_ok
