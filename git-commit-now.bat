@echo off
cd /d "D:\Marc Data\019 MarcVerse\bit-revs"
git add album.html artist.html collections.html compare-artists.html compare.html country.html director.html genre.html home.html lists.html media-detail.html movie-genre.html movies.html music.html series.html top.html wrapped.html wrapped.js
git commit -m "fix(nav+wrapped): Music->Musica en nav + orden manual en Top peliculas de Wrapped"
git push
echo.
echo Listo! Pulsa cualquier tecla para cerrar.
pause
