package com.aplexmovies.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private const val TMDB = "2e45f250dd9649f9c4ac88eb2f62a624"
private const val SB = "https://fubhlmggitebsyanpbux.supabase.co"
private const val SB_KEY = "sb_publishable_vyq0dKDstxbXkfJBJfarLg_A5NvOLcp"
private val bg = Color(0xFF090B12)
private val panel = Color(0xFF171B28)
private val accent = Color(0xFFFF5277)
private val muted = Color(0xFF9AA3B6)
private val edge = Color(0x30FFFFFF)

data class Film(val id:String,val type:String,val title:String,val overview:String="",val poster:String="",val backdrop:String="",val date:String="",val rating:Double=0.0) {
    val year get() = date.take(4).ifBlank { "—" }
    val image get() = if (poster.startsWith("http")) poster else "https://image.tmdb.org/t/p/w500$poster"
    val hero get() = if (backdrop.startsWith("http")) backdrop else "https://image.tmdb.org/t/p/w1280$backdrop"
}
data class Player(val label:String,val url:String)
data class AdminFilm(val id:String,val title:String,val imdb:String,val status:String)
private fun enc(s:String)=URLEncoder.encode(s,"UTF-8")
private fun JSONObject.s(k:String,d:String="")=optString(k,d).let { if(it=="null") d else it }

private object Backend {
    private suspend fun http(url:String,method:String="GET",body:String?=null,token:String?=null,sb:Boolean=false):String=withContext(Dispatchers.IO) {
        val c=URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod=method;c.connectTimeout=15000;c.readTimeout=20000
            c.setRequestProperty("Accept","application/json")
            if(sb){c.setRequestProperty("apikey",SB_KEY);c.setRequestProperty("Authorization","Bearer ${token?:SB_KEY}")}
            if(body!=null){c.doOutput=true;c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Prefer","return=representation");c.outputStream.use{it.write(body.toByteArray())}}
            val code=c.responseCode;val stream=if(code in 200..299)c.inputStream else c.errorStream
            val text=stream?.bufferedReader()?.use{it.readText()}.orEmpty()
            if(code !in 200..299) throw IllegalStateException(runCatching{JSONObject(text).s("message",JSONObject(text).s("error_description",text))}.getOrDefault(text))
            text
        } finally { c.disconnect() }
    }
    private suspend fun tmdb(path:String,params:Map<String,String> = emptyMap()):JSONObject {
        val p=(mapOf("api_key" to TMDB,"include_adult" to "false")+params).entries.joinToString("&"){"${enc(it.key)}=${enc(it.value)}"}
        return JSONObject(http("https://api.themoviedb.org/3$path?$p"))
    }
    private fun JSONArray?.films(fallback:String?=null):List<Film> {
        val a=this?:return emptyList()
        return buildList { for(i in 0 until a.length()){
            val o=a.optJSONObject(i)?:continue
            val type=o.s("media_type",fallback?:"movie")
            if(type!="movie"&&type!="tv")continue
            add(Film(o.opt("id").toString(),type,o.s(if(type=="tv")"name" else "title",o.s("title",o.s("name","Untitled"))),
                o.s("overview"),o.s("poster_path"),o.s("backdrop_path"),o.s(if(type=="tv")"first_air_date" else "release_date"),o.optDouble("vote_average")))
        }}
    }
    suspend fun discover(type:String)=tmdb("/trending/$type/week").optJSONArray("results").films(type)
    suspend fun search(q:String,type:String)=tmdb("/search/multi",mapOf("query" to q)).optJSONArray("results").films().filter{it.type==type}
    suspend fun detail(f:Film)=tmdb("/${f.type}/${f.id}",mapOf("append_to_response" to "videos,credits"))
    suspend fun publishedId(id:String):String? {
        val a=JSONArray(http("$SB/rest/v1/movies?select=id&tmdb_id=eq.${enc(id)}&status=eq.published&limit=1",sb=true))
        return if(a.length()>0)a.getJSONObject(0).s("id") else null
    }
    suspend fun players(id:String):List<Player>{
        val a=JSONArray(http("$SB/rest/v1/movie_players?select=label,player_url&movie_id=eq.${enc(id)}&order=sort_order.asc",sb=true))
        return buildList{for(i in 0 until a.length()){val o=a.getJSONObject(i);add(Player(o.s("label","Player"),o.s("player_url")))}}
    }
    suspend fun download(id:String):String?{
        val a=JSONArray(http("$SB/rest/v1/movies?select=download_url&id=eq.${enc(id)}&limit=1",sb=true))
        return if(a.length()>0)a.getJSONObject(0).s("download_url").ifBlank{null}else null
    }
    suspend fun login(email:String,password:String):String {
        val o=JSONObject(http("$SB/auth/v1/token?grant_type=password","POST",JSONObject().put("email",email).put("password",password).toString(),sb=true))
        val token=o.s("access_token");val uid=o.getJSONObject("user").s("id")
        val check=JSONArray(http("$SB/rest/v1/site_admins?select=user_id&user_id=eq.${enc(uid)}",token=token,sb=true))
        if(check.length()==0)error("This account is not registered as an APLEX admin.")
        return token
    }
    suspend fun adminList(token:String):List<AdminFilm>{
        val a=JSONArray(http("$SB/rest/v1/movies?select=id,title,imdb_id,status&order=created_at.desc&limit=50",token=token,sb=true))
        return buildList{for(i in 0 until a.length()){val o=a.getJSONObject(i);add(AdminFilm(o.s("id"),o.s("title"),o.s("imdb_id"),o.s("status")))}}
    }
    suspend fun addMovie(token:String,imdb:String,player:String,download:String){
        require(Regex("^tt\\d{5,12}$",RegexOption.IGNORE_CASE).matches(imdb.trim())){"Enter a valid IMDb ID."}
        val found=tmdb("/find/${enc(imdb.trim())}",mapOf("external_source" to "imdb_id")).optJSONArray("movie_results")?.optJSONObject(0)?:error("No movie found.")
        val d=tmdb("/movie/${found.optInt("id")}",mapOf("append_to_response" to "videos"))
        val title=d.s("title",found.s("title"))
        val genres=d.optJSONArray("genres")?:JSONArray()
        val names=(0 until genres.length()).mapNotNull{genres.optJSONObject(it)?.s("name")}.joinToString(", ")
        val body=JSONObject().put("title",title).put("slug",title.lowercase().replace(Regex("[^a-z0-9]+"),"-").trim('-')+"-"+d.optInt("id"))
            .put("imdb_id",imdb.trim()).put("tmdb_id",d.optInt("id")).put("overview",d.s("overview"))
            .put("release_date",if(d.s("release_date").isBlank()) JSONObject.NULL else d.s("release_date")).put("language",d.s("original_language"))
            .put("runtime",d.optInt("runtime")).put("rating",d.optDouble("vote_average")).put("genres",names)
            .put("poster_url","https://image.tmdb.org/t/p/w500${d.s("poster_path")}")
            .put("backdrop_url","https://image.tmdb.org/t/p/w1280${d.s("backdrop_path")}")
            .put("status","draft").put("download_url",if(download.isBlank()) JSONObject.NULL else download)
        val created=JSONArray(http("$SB/rest/v1/movies","POST",body.toString(),token,true))
        if(created.length()>0&&player.isNotBlank()){
            val id=created.getJSONObject(0).s("id")
            http("$SB/rest/v1/movie_players","POST",JSONObject().put("movie_id",id).put("label","Player 1").put("player_url",player).put("sort_order",1).toString(),token,true)
        }
    }
    suspend fun status(token:String,id:String,value:String){http("$SB/rest/v1/movies?id=eq.${enc(id)}","PATCH",JSONObject().put("status",value).toString(),token,true)}
    suspend fun delete(token:String,id:String){http("$SB/rest/v1/movies?id=eq.${enc(id)}","DELETE",token=token,sb=true)}
}

class MainActivity:ComponentActivity(){
    override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState)
        window.statusBarColor=android.graphics.Color.rgb(9,11,18);window.navigationBarColor=android.graphics.Color.rgb(9,11,18)
        setContent{AplexNative()}
    }
}

@Composable private fun AplexNative(){
    var tab by remember{mutableStateOf("Home")};var type by remember{mutableStateOf("movie")}
    var query by remember{mutableStateOf("")};var year by remember{mutableStateOf("")};var genre by remember{mutableStateOf("")}
    var films by remember{mutableStateOf(emptyList<Film>())};var chosen by remember{mutableStateOf<Film?>(null)}
    var details by remember{mutableStateOf<JSONObject?>(null)};var players by remember{mutableStateOf(emptyList<Player>())};var download by remember{mutableStateOf<String?>(null)}
    var loading by remember{mutableStateOf(false)};var error by remember{mutableStateOf("")}
    val scope= rememberCoroutineScope()
    LaunchedEffect(query,type){delay(400);loading=true;runCatching{if(query.isBlank())Backend.discover(type)else Backend.search(query,type)}
        .onSuccess{films=it;error=""}.onFailure{error=it.message?:"Could not load catalogue."};loading=false}
    MaterialTheme(colorScheme=darkColorScheme(primary=accent,background=bg,surface=panel,onSurface=Color.White,onBackground=Color.White)){
        Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF14203A),bg,Color(0xFF24121D))))) {
            Column(Modifier.fillMaxSize()){
                if(chosen==null&&tab=="Home"){
                    Header()
                    Row(Modifier.padding(horizontal=18.dp,vertical=6.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        Pill("Movies",type=="movie"){type="movie"};Pill("TV Shows",type=="tv"){type="tv"}
                    }
                    OutlinedTextField(query,{query=it},Modifier.fillMaxWidth().padding(horizontal=18.dp),placeholder={Text("Search movies and TV shows…",color=muted)},
                        leadingIcon={Icon(Icons.Default.Search,null,tint=muted)},singleLine=true,shape=RoundedCornerShape(17.dp),colors=fieldColors())
                    Row(Modifier.padding(horizontal=18.dp,vertical=8.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        OutlinedTextField(year,{year=it.filter(Char::isDigit).take(4)},Modifier.weight(1f),placeholder={Text("Year",color=muted)},singleLine=true,shape=RoundedCornerShape(13.dp),colors=fieldColors())
                        OutlinedTextField(genre,{genre=it},Modifier.weight(1.4f),placeholder={Text("Genre / keyword",color=muted)},singleLine=true,shape=RoundedCornerShape(13.dp),colors=fieldColors())
                    }
                    Text(if(query.isBlank())"TRENDING THIS WEEK" else "SEARCH RESULTS",Modifier.padding(start=20.dp,top=9.dp,bottom=8.dp),color=accent,fontSize=11.sp,fontWeight=FontWeight.Bold,letterSpacing=2.sp)
                    val shown=films.filter{(year.isBlank()||it.year==year)&&(genre.isBlank()||it.title.contains(genre,true)||it.overview.contains(genre,true))}
                    if(loading&&shown.isEmpty())Box(Modifier.weight(1f).fillMaxWidth(),contentAlignment=Alignment.Center){CircularProgressIndicator(color=accent)}
                    else if(error.isNotBlank()&&shown.isEmpty())Box(Modifier.weight(1f).fillMaxWidth(),contentAlignment=Alignment.Center){Text(error,color=Color.White)}
                    else LazyVerticalGrid(GridCells.Fixed(2),Modifier.weight(1f),contentPadding=PaddingValues(14.dp),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
                        items(items=shown, key={ film -> "${film.type}-${film.id}" }) { f -> FilmCard(f) {
                            chosen=f;details=null;players=emptyList();download=null;loading=true
                            scope.launch{runCatching{val d=Backend.detail(f);val id=Backend.publishedId(f.id);Triple(d,id?.let{Backend.players(it)}.orEmpty(),id?.let{Backend.download(it)})}
                                .onSuccess{details=it.first;players=it.second;download=it.third}.onFailure{error=it.message?:"Could not load details."};loading=false}
                        }}
                    }
                }else if(chosen!=null)Detail(chosen!!,details,players,download,loading,error){chosen=null}
                else AdminPanel()
                if(chosen==null)BottomNav(tab){tab=it}
            }
        }
    }
}

@Composable private fun Header(){
    Row(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=15.dp),verticalAlignment=Alignment.CenterVertically){
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(listOf(accent,Color(0xFF805BFF)))),contentAlignment=Alignment.Center){Text("A",fontSize=25.sp,fontWeight=FontWeight.Black)}
        Column(Modifier.padding(start=11.dp)){Text("APLEX",fontSize=22.sp,fontWeight=FontWeight.Black,letterSpacing=2.sp);Text("MOVIES  ·  YOUR NEXT WATCH",fontSize=9.sp,color=muted,letterSpacing=1.sp)}
        Spacer(Modifier.weight(1f));Text("NATIVE",Modifier.clip(CircleShape).background(Color(0x22FFFFFF)).border(1.dp,edge,CircleShape).padding(horizontal=12.dp,vertical=8.dp),fontSize=9.sp,color=Color(0xFFB8C6FF),fontWeight=FontWeight.Bold)
    }
}
@Composable private fun FilmCard(f:Film,onClick:()->Unit){
    Column(Modifier.clip(RoundedCornerShape(17.dp)).background(Brush.linearGradient(listOf(Color(0x302FFFFFF),Color(0x121FFFFFF)))).border(1.dp,edge,RoundedCornerShape(17.dp)).clickable{onClick()}.padding(8.dp)){
        Box{AsyncImage(f.image,f.title,Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(12.dp)))
            if(f.rating>0)Text("★ ${"%.1f".format(f.rating)}",Modifier.align(Alignment.TopEnd).padding(7.dp).clip(CircleShape).background(Color(0xCC090B12)).padding(horizontal=8.dp,vertical=5.dp),color=Color(0xFFFFD36B),fontSize=10.sp,fontWeight=FontWeight.Bold)}
        Text(f.title,color=Color.White,fontWeight=FontWeight.SemiBold,fontSize=13.sp,maxLines=1,overflow=TextOverflow.Ellipsis,modifier=Modifier.padding(top=8.dp))
        Text("${f.year}  ·  ${f.type.uppercase()}",color=muted,fontSize=10.sp,modifier=Modifier.padding(top=3.dp,bottom=3.dp))
    }
}
@Composable private fun Detail(f:Film,d:JSONObject?,players:List<Player>,download:String?,loading:Boolean,error:String,onBack:()->Unit){
    val ctx= LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())){
        Box{AsyncImage(f.hero,null,Modifier.fillMaxWidth().height(220.dp));Box(Modifier.fillMaxWidth().height(220.dp).background(Brush.verticalGradient(listOf(Color.Transparent,bg))))
            IconButton(onBack,Modifier.padding(10.dp).clip(CircleShape).background(Color(0xAA090B12))){Icon(Icons.Default.ArrowBack,null,tint=Color.White)}}
        Row(Modifier.padding(horizontal=18.dp).offset(y=(-42).dp),verticalAlignment=Alignment.Bottom){
            AsyncImage(f.image,f.title,Modifier.width(112.dp).height(165.dp).clip(RoundedCornerShape(14.dp)).border(1.dp,edge,RoundedCornerShape(14.dp)))
            Column(Modifier.weight(1f).padding(start=13.dp,bottom=5.dp)){Text(f.title,fontSize=20.sp,fontWeight=FontWeight.Bold,color=Color.White);Text("${f.year} · ${f.type.uppercase()}",color=muted,fontSize=11.sp);Text("★ ${"%.1f".format(f.rating)} / 10",color=Color(0xFFFFD36B),fontSize=12.sp)}
        }
        Column(Modifier.padding(horizontal=20.dp).offset(y=(-22).dp)){
            Text("OVERVIEW",color=accent,fontSize=11.sp,fontWeight=FontWeight.Bold,letterSpacing=2.sp)
            Text(d?.s("overview")?.ifBlank{f.overview}?:f.overview,color=Color(0xFFD7DBE5),fontSize=13.sp,lineHeight=20.sp,modifier=Modifier.padding(top=8.dp))
            if(loading)LinearProgressIndicator(Modifier.fillMaxWidth().padding(top=12.dp),color=accent)
            if(error.isNotBlank())Text(error,color=Color(0xFFFF8DA5),fontSize=12.sp)
            val videos=d?.optJSONObject("videos")?.optJSONArray("results")
            val trailer=videos?.let{a->(0 until a.length()).mapNotNull{a.optJSONObject(it)}.firstOrNull{it.s("site")=="YouTube"&&(it.s("type")=="Trailer"||it.s("type")=="Teaser")}?.s("key")}
            if(!trailer.isNullOrBlank())NativeButton("WATCH TRAILER",true){ctx.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.youtube.com/watch?v=$trailer")))}
            if(players.isNotEmpty()){Text("AVAILABLE PLAYERS",color=accent,fontSize=11.sp,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=16.dp));players.forEach{p->NativeButton(p.label,false){safeOpen(ctx,p.url)}}}
            if(!download.isNullOrBlank())NativeButton("DOWNLOAD",true){safeOpen(ctx,download)}
            if(players.isEmpty()&&download.isNullOrBlank())Text("No player or download link has been added by the APLEX admin yet.",color=muted,fontSize=12.sp,modifier=Modifier.padding(top=16.dp))
            Spacer(Modifier.height(30.dp))
        }
    }
}
private fun safeOpen(ctx:android.content.Context,url:String){val u=runCatching{Uri.parse(url)}.getOrNull()?:return;if(u.scheme=="https"||u.scheme=="http")runCatching{ctx.startActivity(Intent(Intent.ACTION_VIEW,u))}}

@Composable private fun AdminPanel(){
    val scope= rememberCoroutineScope();var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")}
    var imdb by remember{mutableStateOf("")};var player by remember{mutableStateOf("")};var download by remember{mutableStateOf("")}
    var token by remember{mutableStateOf<String?>(null)};var films by remember{mutableStateOf(emptyList<AdminFilm>())}
    var message by remember{mutableStateOf("")};var loading by remember{mutableStateOf(false)}
    LaunchedEffect(token){if(token!=null)runCatching{Backend.adminList(token!!)}.onSuccess{films=it}.onFailure{message=it.message?:"Load failed."}}
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal=18.dp)){
        Text("ADMIN CONTROL",color=accent,fontSize=11.sp,fontWeight=FontWeight.Bold,letterSpacing=2.sp,modifier=Modifier.padding(top=18.dp))
        Text("APLEX Control Room",color=Color.White,fontSize=24.sp,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=5.dp,bottom=15.dp))
        if(token==null){
            Text("Sign in with your existing Supabase admin account.",color=muted,fontSize=13.sp)
            OutlinedTextField(email,{email=it},Modifier.fillMaxWidth(),label={Text("Email")},singleLine=true,colors=fieldColors())
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(password,{password=it},Modifier.fillMaxWidth(),label={Text("Password")},singleLine=true,visualTransformation=PasswordVisualTransformation(),colors=fieldColors())
            NativeButton(if(loading)"SIGNING IN…" else "SIGN IN",true,!loading){scope.launch{loading=true;runCatching{Backend.login(email.trim(),password)}.onSuccess{token=it}.onFailure{message=it.message?:"Sign in failed."};loading=false}}
        }else{
            Row(verticalAlignment=Alignment.CenterVertically){Text("MOVIE LIBRARY",Modifier.weight(1f),color=Color.White,fontWeight=FontWeight.Bold);TextButton(onClick={token=null;password=""}){Text("Sign out",color=accent)}}
            Text("New titles are saved as drafts.",color=muted,fontSize=12.sp)
            OutlinedTextField(imdb,{imdb=it},Modifier.fillMaxWidth(),label={Text("IMDb ID (tt1234567)")},singleLine=true,colors=fieldColors())
            OutlinedTextField(player,{player=it},Modifier.fillMaxWidth(),label={Text("Player URL (optional)")},singleLine=true,colors=fieldColors())
            OutlinedTextField(download,{download=it},Modifier.fillMaxWidth(),label={Text("Download URL (optional)")},singleLine=true,colors=fieldColors())
            NativeButton(if(loading)"ADDING…" else "ADD MOVIE AS DRAFT",true,!loading){scope.launch{loading=true;runCatching{Backend.addMovie(token!!,imdb,player,download)}.onSuccess{message="Saved as draft.";imdb="";player="";download="";films=Backend.adminList(token!!)}.onFailure{message=it.message?:"Add failed."};loading=false}}
            Text("RECENT MOVIES",color=accent,fontSize=11.sp,fontWeight=FontWeight.Bold,modifier=Modifier.padding(top=18.dp))
            films.forEach{m->Row(Modifier.fillMaxWidth().padding(vertical=6.dp).clip(RoundedCornerShape(13.dp)).background(Color(0x20FFFFFF)).border(1.dp,edge,RoundedCornerShape(13.dp)).padding(10.dp),verticalAlignment=Alignment.CenterVertically){
                Column(Modifier.weight(1f)){Text(m.title,color=Color.White,fontSize=12.sp,maxLines=1);Text("${m.imdb} · ${m.status}",color=muted,fontSize=10.sp)}
                TextButton(onClick={scope.launch{runCatching{Backend.status(token!!,m.id,if(m.status=="published")"draft" else "published");Backend.adminList(token!!)}.onSuccess{films=it}.onFailure{message=it.message?:"Update failed."}}}){Text(if(m.status=="published")"Hide" else "Publish",color=accent,fontSize=11.sp)}
                TextButton(onClick={scope.launch{runCatching{Backend.delete(token!!,m.id);Backend.adminList(token!!)}.onSuccess{films=it}.onFailure{message=it.message?:"Delete failed."}}}){Text("Delete",color=Color(0xFFFF8DA5),fontSize=11.sp)}
            }}
        }
        if(message.isNotBlank())Text(message,color=if(message.contains("fail",true)||message.contains("error",true))Color(0xFFFF8DA5) else Color(0xFF9BE3B3),fontSize=12.sp,modifier=Modifier.padding(vertical=10.dp))
        Spacer(Modifier.height(24.dp))
    }
}
@Composable private fun BottomNav(current:String,onSelect:(String)->Unit){
    Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal=18.dp,vertical=9.dp).clip(RoundedCornerShape(22.dp)).background(Color(0xDD171B28)).border(1.dp,edge,RoundedCornerShape(22.dp)).padding(6.dp)){
        listOf("Home","Admin").forEach{label->Box(Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(if(current==label)Color(0x35FF5277) else Color.Transparent).clickable{onSelect(label)}.padding(vertical=12.dp),contentAlignment=Alignment.Center){Text(label,color=if(current==label)Color.White else muted,fontWeight=FontWeight.SemiBold,fontSize=12.sp)}}
    }
}
@Composable private fun Pill(text:String,active:Boolean,onClick:()->Unit){
    Box(Modifier.clip(CircleShape).background(if(active)Color(0x44FF5277) else Color(0x20FFFFFF)).border(1.dp,if(active)accent.copy(alpha=.55f) else edge,CircleShape).clickable{onClick()}.padding(horizontal=17.dp,vertical=9.dp)){Text(text,color=if(active)Color.White else muted,fontSize=12.sp,fontWeight=FontWeight.SemiBold)}
}
@Composable private fun NativeButton(text:String,primary:Boolean,enabled:Boolean=true,onClick:()->Unit){
    Button(onClick=onClick,enabled=enabled,modifier=Modifier.fillMaxWidth().padding(vertical=4.dp).height(47.dp),shape=RoundedCornerShape(15.dp),
        colors=ButtonDefaults.buttonColors(containerColor=if(primary)accent else Color(0xFF252B3C),contentColor=Color.White)){
        Text(text,fontWeight=FontWeight.Bold,fontSize=12.sp,letterSpacing=.7.sp)
    }
}
@Composable private fun fieldColors()=OutlinedTextFieldDefaults.colors(focusedBorderColor=accent,unfocusedBorderColor=edge,focusedContainerColor=Color(0x20FFFFFF),unfocusedContainerColor=Color(0x20FFFFFF),focusedTextColor=Color.White,unfocusedTextColor=Color.White,focusedLabelColor=accent,unfocusedLabelColor=muted,cursorColor=accent)
