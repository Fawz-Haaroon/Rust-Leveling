use actix_files::Files;
use actix_web::{get, middleware::Logger, web, App, HttpResponse, HttpServer, Responder, Result};
use chrono::{DateTime, TimeZone, Utc};
use dotenv::dotenv;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env, io};

// Current weather structures
#[derive(Deserialize, Debug)]
struct WeatherResponse {
    name: String,
    main: WeatherMain,
    weather: Vec<WeatherCondition>,
    wind: Option<Wind>,
    clouds: Option<Clouds>,
    visibility: Option<u32>,
    dt: i64,
    sys: WeatherSys,
    coord: Coord,
}

#[derive(Deserialize, Debug)]
struct WeatherMain {
    temp: f64,
    feels_like: f64,
    temp_min: f64,
    temp_max: f64,
    pressure: u32,
    humidity: u32,
    sea_level: Option<u32>,
    grnd_level: Option<u32>,
}

#[derive(Deserialize, Debug)]
struct WeatherCondition {
    id: u32,
    main: String,
    description: String,
    icon: String,
}

#[derive(Deserialize, Debug)]
struct Wind {
    speed: f64,
    deg: Option<u32>,
    gust: Option<f64>,
}

#[derive(Deserialize, Debug)]
struct Clouds {
    all: u32,
}

#[derive(Deserialize, Debug)]
struct WeatherSys {
    country: String,
    sunrise: i64,
    sunset: i64,
}

#[derive(Deserialize, Debug)]
struct Coord {
    lon: f64,
    lat: f64,
}

// Forecast structures
#[derive(Deserialize, Debug)]
struct ForecastResponse {
    list: Vec<ForecastItem>,
    city: ForecastCity,
}

#[derive(Deserialize, Debug)]
struct ForecastItem {
    dt: i64,
    main: WeatherMain,
    weather: Vec<WeatherCondition>,
    wind: Option<Wind>,
    clouds: Option<Clouds>,
    visibility: Option<u32>,
    dt_txt: String,
}

#[derive(Deserialize, Debug)]
struct ForecastCity {
    name: String,
    country: String,
    coord: Coord,
    sunrise: i64,
    sunset: i64,
}

// Response structures for API
#[derive(Serialize)]
struct WeatherJsonResponse {
    city: String,
    country: String,
    temperature: f64,
    feels_like: f64,
    temp_min: f64,
    temp_max: f64,
    humidity: u32,
    pressure: u32,
    description: String,
    icon: String,
    wind_speed: Option<f64>,
    wind_direction: Option<u32>,
    cloudiness: Option<u32>,
    visibility: Option<u32>,
    sunrise: String,
    sunset: String,
    coordinates: (f64, f64),
    timestamp: String,
}

#[derive(Serialize)]
struct ForecastJsonResponse {
    city: String,
    country: String,
    forecasts: Vec<ForecastItemJson>,
}

#[derive(Serialize)]
struct ForecastItemJson {
    datetime: String,
    temperature: f64,
    feels_like: f64,
    temp_min: f64,
    temp_max: f64,
    humidity: u32,
    pressure: u32,
    description: String,
    icon: String,
    wind_speed: Option<f64>,
    cloudiness: Option<u32>,
}

fn format_timestamp(timestamp: i64) -> String {
    let dt: DateTime<Utc> = Utc.timestamp_opt(timestamp, 0).single().unwrap();
    dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
}

fn get_weather_emoji(icon: &str) -> &'static str {
    match &icon[0..2] {
        "01" => "☀️",  // clear sky
        "02" => "⛅", // few clouds
        "03" => "☁️",  // scattered clouds
        "04" => "☁️",  // broken clouds
        "09" => "🌧️", // shower rain
        "10" => "🌦️", // rain
        "11" => "⛈️",  // thunderstorm
        "13" => "🌨️", // snow
        "50" => "🌫️", // mist
        _ => "🌤️",
    }
}

#[get("/")]
async fn root() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(include_str!("../static/index.html")))
}

#[get("/api")]
async fn api_root() -> impl Responder {
    HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .body("🌦️ Welcome to the Advanced Rust Weather API!\n\nEndpoints:\n• GET /api/weather?city=YourCity - Current weather\n• GET /api/forecast?city=YourCity - 5-day forecast\n• GET /api/weather?city=YourCity&format=json - JSON response")
}

#[get("/api/weather")]
async fn fetch_weather(query: web::Query<HashMap<String, String>>) -> impl Responder {
    let city = match query.get("city") {
        Some(name) if !name.trim().is_empty() => name.trim(),
        _ => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({
                    "error": "Missing or empty `city` query parameter",
                    "message": "Please provide a valid city name"
                }));
        }
    };

    let format = query.get("format").map(|s| s.as_str()).unwrap_or("text");

    let api_key = match env::var("OPENWEATHER_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({
                    "error": "Missing OPENWEATHER_API_KEY",
                    "message": "Server configuration error"
                }));
        }
    };

    let request_url = format!(
        "https://api.openweathermap.org/data/2.5/weather?q={}&appid={}&units=metric",
        urlencoding::encode(city), api_key
    );

    let client = Client::new();

    let response = match client.get(&request_url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("Network error: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({
                    "error": "Network error",
                    "message": "Failed to reach weather API"
                }));
        }
    };

    if !response.status().is_success() {
        let status = response.status().as_u16();
        return HttpResponse::NotFound()
            .json(serde_json::json!({
                "error": "City not found",
                "message": format!("Weather API returned status: {}", status),
                "city_searched": city
            }));
    }

    let weather_data: WeatherResponse = match response.json().await {
        Ok(data) => data,
        Err(e) => {
            eprintln!("JSON parsing error: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({
                    "error": "Data parsing error",
                    "message": "Failed to parse weather API response"
                }));
        }
    };

    if format == "json" {
        let json_response = WeatherJsonResponse {
            city: weather_data.name.clone(),
            country: weather_data.sys.country.clone(),
            temperature: weather_data.main.temp,
            feels_like: weather_data.main.feels_like,
            temp_min: weather_data.main.temp_min,
            temp_max: weather_data.main.temp_max,
            humidity: weather_data.main.humidity,
            pressure: weather_data.main.pressure,
            description: weather_data.weather[0].description.clone(),
            icon: weather_data.weather[0].icon.clone(),
            wind_speed: weather_data.wind.as_ref().map(|w| w.speed),
            wind_direction: weather_data.wind.as_ref().and_then(|w| w.deg),
            cloudiness: weather_data.clouds.as_ref().map(|c| c.all),
            visibility: weather_data.visibility,
            sunrise: format_timestamp(weather_data.sys.sunrise),
            sunset: format_timestamp(weather_data.sys.sunset),
            coordinates: (weather_data.coord.lat, weather_data.coord.lon),
            timestamp: format_timestamp(weather_data.dt),
        };

        return HttpResponse::Ok().json(json_response);
    }

    let emoji = get_weather_emoji(&weather_data.weather[0].icon);
    let wind_info = match &weather_data.wind {
        Some(wind) => match wind.deg {
            Some(deg) => format!("💨 Wind: {:.1} m/s at {}°", wind.speed, deg),
            None => format!("💨 Wind: {:.1} m/s", wind.speed),
        },
        None => "💨 Wind: No data".to_string(),
    };

    let visibility_info = match weather_data.visibility {
        Some(vis) => format!("👁️ Visibility: {:.1} km", vis as f64 / 1000.0),
        None => "👁️ Visibility: No data".to_string(),
    };

    let clouds_info = match &weather_data.clouds {
        Some(clouds) => format!("☁️ Cloudiness: {}%", clouds.all),
        None => "☁️ Cloudiness: No data".to_string(),
    };

    let summary = format!(
        "{} {} Weather Report {}\n\n📍 Location: {}, {}\n🌐 Coordinates: {:.2}°N, {:.2}°E\n\n🌡️ Temperature: {:.1}°C (feels like {:.1}°C)\n📊 Min/Max: {:.1}°C / {:.1}°C\n💧 Humidity: {}%\n🔽 Pressure: {} hPa\n☁️ Conditions: {}\n{}\n{}\n{}\n\n🌅 Sunrise: {}\n🌇 Sunset: {}\n⏰ Last Updated: {}",
        emoji,
        weather_data.name,
        emoji,
        weather_data.name,
        weather_data.sys.country,
        weather_data.coord.lat,
        weather_data.coord.lon,
        weather_data.main.temp,
        weather_data.main.feels_like,
        weather_data.main.temp_min,
        weather_data.main.temp_max,
        weather_data.main.humidity,
        weather_data.main.pressure,
        weather_data.weather[0].description,
        wind_info,
        visibility_info,
        clouds_info,
        format_timestamp(weather_data.sys.sunrise),
        format_timestamp(weather_data.sys.sunset),
        format_timestamp(weather_data.dt)
    );

    HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .body(summary)
}

#[get("/api/forecast")]
async fn fetch_forecast(query: web::Query<HashMap<String, String>>) -> impl Responder {
    let city = match query.get("city") {
        Some(name) if !name.trim().is_empty() => name.trim(),
        _ => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({
                    "error": "Missing or empty `city` query parameter",
                    "message": "Please provide a valid city name"
                }));
        }
    };

    let api_key = match env::var("OPENWEATHER_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({
                    "error": "Missing OPENWEATHER_API_KEY",
                    "message": "Server configuration error"
                }));
        }
    };

    let request_url = format!(
        "https://api.openweathermap.org/data/2.5/forecast?q={}&appid={}&units=metric",
        urlencoding::encode(city), api_key
    );

    let client = Client::new();

    let response = match client.get(&request_url).send().await {
        Ok(resp) => resp,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({
                    "error": "Network error",
                    "message": "Failed to reach weather API"
                }));
        }
    };

    if !response.status().is_success() {
        return HttpResponse::NotFound()
            .json(serde_json::json!({
                "error": "City not found",
                "message": "Failed to fetch forecast data"
            }));
    }

    let forecast_data: ForecastResponse = match response.json().await {
        Ok(data) => data,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({
                    "error": "Data parsing error",
                    "message": "Failed to parse forecast API response"
                }));
        }
    };

    let format = query.get("format").map(|s| s.as_str()).unwrap_or("text");

    if format == "json" {
        let json_forecasts: Vec<ForecastItemJson> = forecast_data.list.into_iter().map(|item| {
            ForecastItemJson {
                datetime: item.dt_txt,
                temperature: item.main.temp,
                feels_like: item.main.feels_like,
                temp_min: item.main.temp_min,
                temp_max: item.main.temp_max,
                humidity: item.main.humidity,
                pressure: item.main.pressure,
                description: item.weather[0].description.clone(),
                icon: item.weather[0].icon.clone(),
                wind_speed: item.wind.as_ref().map(|w| w.speed),
                cloudiness: item.clouds.as_ref().map(|c| c.all),
            }
        }).collect();

        let json_response = ForecastJsonResponse {
            city: forecast_data.city.name,
            country: forecast_data.city.country,
            forecasts: json_forecasts,
        };

        return HttpResponse::Ok().json(json_response);
    }

    let mut forecast_text = format!(
        "🔮 5-Day Forecast for {}, {}\n{}\n\n",
        forecast_data.city.name,
        forecast_data.city.country,
        "=".repeat(50)
        );

    for (i, item) in forecast_data.list.iter().enumerate().take(40) { // 5 days * 8 per day
        if i % 8 == 0 {
            forecast_text.push_str(&format!("\n📅 Day {} Forecast:\n{}\n", (i / 8) + 1, "-".repeat(30)));
        }
        
        let emoji = get_weather_emoji(&item.weather[0].icon);
        let wind_info = match &item.wind {
            Some(wind) => format!(" | 💨 {:.1}m/s", wind.speed),
            None => String::new(),
        };

        forecast_text.push_str(&format!(
            "{} {} | {:.1}°C (feels {:.1}°C) | 💧{}% | {} {}\n",
            &item.dt_txt[11..16], // Extract time HH:MM
            emoji,
            item.main.temp,
            item.main.feels_like,
            item.main.humidity,
            item.weather[0].description,
            wind_info
        ));
    }

    HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .body(forecast_text)
}

#[actix_web::main]
async fn main() -> io::Result<()> {
    dotenv().ok();

    // Initialize logger
    env_logger::init();

    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);
    
    let host = "0.0.0.0";

    println!("🚀 Advanced Weather Dashboard Server");
    println!("📡 Running at http://{}:{}", host, port);
    println!("🔥 Powered by Rust & Actix-Web");
    println!("⚡ Ultra-low latency weather analytics");

    HttpServer::new(|| {
        App::new()
            .wrap(Logger::default())
            .service(root)
            .service(api_root)
            .service(fetch_weather)
            .service(fetch_forecast)
            .service(Files::new("/static", "./static").show_files_listing())
            .service(Files::new("/", "./static").index_file("index.html"))
    })
    .bind((host, port))?
    .run()
    .await
}