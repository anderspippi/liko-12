#!/usr/bin/env bash
set -e;

# FIXME: Update the Windows build script to the new project structure.

# TODO: Don't override them when already set.
LOVE_VERSION='11.4';
LIKO_VERSION='2.0.0';

# TODO: Tag the LIKO-12 build

if [ ! -d 'src' ]; then
    echo "Error: The script should be run with the root of the repository as the working directory." >&2;
    exit 1;
fi

#--------------------------------------------------------------------------------#

function section {
    echo '';
    echo "--[[ $* ]]--";
    echo '';
}

#--------------------------------------------------------------------------------#

if [ -d 'dist/temp' ]; then
    section "Cleaning Up Previous Build Junk";
    rm -rv 'dist/temp';
fi

[ -d 'dist' ] || mkdir 'dist'; # for doing the scripts operations in.
[ -d 'dist/tools' ] || mkdir 'dist/tools'; # for storing build tools.
[ -d 'dist/love' ] || mkdir 'dist/love'; # for storing original love binaries.
[ -d 'dist/temp' ] || mkdir 'dist/temp'; # for storing temporary working directory.
[ -d 'dist/out' ] || mkdir 'dist/out'; # for storing the result packages.

#--------------------------------------------------------------------------------#

section 'Download Building Materials';

declare -A materials=(
    ['dist/tools/7zr.exe']='https://www.7-zip.org/a/7zr.exe'
    ['dist/tools/7z-extra.7z']='https://www.7-zip.org/a/7z2201-extra.7z'
    ['dist/tools/rcedit-x64.exe']='https://github.com/electron/rcedit/releases/download/v1.1.1/rcedit-x64.exe'
    ["dist/love/love_${LOVE_VERSION}_win64.zip"]="https://github.com/love2d/love/releases/download/${LOVE_VERSION}/love-${LOVE_VERSION}-win64.zip"
    ["dist/love/love_${LOVE_VERSION}_win32.zip"]="https://github.com/love2d/love/releases/download/${LOVE_VERSION}/love-${LOVE_VERSION}-win32.zip"
);

for filename in ${!materials[@]}; do
    if [ -a $filename ]; then
        echo "- Skipping $filename: already exists.";
        continue;
    fi

    echo "- $filename: ${materials[$filename]}";
    curl -o $filename -L ${materials[$filename]} --fail-with-body;
done

#--------------------------------------------------------------------------------#

section 'Extract Archives';

declare -A extract=(
    ['dist/temp/love_win64']="dist/love/love_${LOVE_VERSION}_win64.zip"
    ['dist/temp/love_win32']="dist/love/love_${LOVE_VERSION}_win32.zip"
);

for destination in ${!extract[@]}; do
    if [ -a $destination ]; then
        continue;
        echo "Error: $destination already exists!" >&2;
        exit 1;
    fi

    echo "- Extracting ${extract[$destination]} -> $destination";
    echo "";
    unzip -j ${extract[$destination]} -d $destination;
    echo "";
done

# 7zr can only extract .7z archives, so extract the full 7za that works with zip archives.

echo "- Extracting dist/tools/7z-extra.7z/x64 -> dist/temp";
dist/tools/7zr.exe e dist/tools/7z-extra.7z -odist/temp -y x64/*;

#--------------------------------------------------------------------------------#

section 'Pack Universal .love File';

(cd src; ../dist/temp/7za.exe a ../dist/temp/release.love -tzip *);

#--------------------------------------------------------------------------------#

section 'Patch Executables Metadata';

for arch in 'win32' 'win64'; do
    echo "- Patch love.exe ($arch)";
    dist/tools/rcedit-x64.exe "dist/temp/love_${arch}/love.exe" \
        --set-icon scripts/assets/icon.ico \
        --set-file-version $LIKO_VERSION \
        --set-product-version $LIKO_VERSION \
        --set-version-string FileDescription 'An open-source fantasy computer' \
        --set-version-string CompanyName 'Rami Sabbagh' \
        --set-version-string LegalCopyright 'Copyright ⓒ 2017-2022 Rami Sabbagh' \
        --set-version-string ProductName 'LIKO-12' \
        --set-version-string OriginalFilename 'LIKO-12.exe';
    
    echo "- Patch lovec.exe ($arch)";
    dist/tools/rcedit-x64.exe "dist/temp/love_${arch}/lovec.exe" \
        --set-icon scripts/assets/icon.ico \
        --set-file-version $LIKO_VERSION \
        --set-product-version $LIKO_VERSION \
        --set-version-string FileDescription 'An open-source fantasy computer (terminal/console version)' \
        --set-version-string CompanyName 'Rami Sabbagh' \
        --set-version-string LegalCopyright 'Copyright ⓒ 2017-2022 Rami Sabbagh' \
        --set-version-string ProductName 'LIKO-12' \
        --set-version-string OriginalFilename 'liko12c.exe';
done

#--------------------------------------------------------------------------------#

section 'Cook The Pachages';

for arch in 'win32' 'win64'; do
    echo "- Fuse LIKO-12.exe ($arch)";
    cat "dist/temp/love_${arch}/love.exe" dist/temp/release.love > "dist/temp/love_${arch}/LIKO-12.exe";
    echo "- Fuse liko12c.exe ($arch)";
    cat "dist/temp/love_${arch}/lovec.exe" dist/temp/release.love > "dist/temp/love_${arch}/liko12c.exe";
    echo '- Cleanup old executables';
    rm -v "dist/temp/love_${arch}/love.exe" "dist/temp/love_${arch}/lovec.exe";

    echo '- Remove unnecessary files';
    rm -v "dist/temp/love_${arch}/readme.txt" "dist/temp/love_${arch}/changes.txt"\
        "dist/temp/love_${arch}/love.ico" "dist/temp/love_${arch}/game.ico";

    echo '- Add license files';
    mv -v "dist/temp/love_${arch}/license.txt" "dist/temp/love_${arch}/LOVE-LICENSE.txt";
    cp -v "LICENSE" "dist/temp/love_${arch}/LIKO-12-LICENSE.txt";
done

#--------------------------------------------------------------------------------#

section 'Archive The Packages';

for arch in 'win32' 'win64'; do
    if [ -a "dist/out/liko_${arch}.zip" ]; then rm -v "dist/out/liko_${arch}.zip"; fi;
    (cd "dist/temp/love_${arch}"; ../7za.exe a "../../out/liko_${arch}.zip" -tzip *);
done

#--------------------------------------------------------------------------------#

section 'Cleanup';

rm -rv 'dist/temp';

#--------------------------------------------------------------------------------#

section 'Completed The Build Successfully';

echo 'Check for the result files in the "dist/out" directory:';
echo '';
echo '- dist/out/liko_win32.zip';
echo '- dist/out/liko_win64.zip';
