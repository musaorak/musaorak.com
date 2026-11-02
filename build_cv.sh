#!/bin/sh
# Rebuild Orak_CV.pdf from main.tex (run twice so page numbers resolve).
set -e
cd "$(dirname "$0")"
pdflatex -interaction=nonstopmode main.tex >/dev/null
pdflatex -interaction=nonstopmode main.tex >/dev/null
mv main.pdf Orak_CV.pdf
rm -f main.aux main.log main.out
echo "Built Orak_CV.pdf"
