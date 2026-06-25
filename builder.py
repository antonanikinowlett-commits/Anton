#!/usr/bin/env python3
"""
builder.py — Step 4 of the SiteSnap pipeline.

Takes a business dict + design preferences and generates a polished,
animated, multi-page HTML website. Each page is a separate .html file:
  index.html      — Hero + About
  services.html   — What they offer
  gallery.html    — Images
  contact.html    — Hours, address, phone, map link

Usage:
    python3 builder.py --business '{"name":"..."}' --theme warm --sections all --details "modern feel"

Or import and call build() directly from pipeline.py.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ── Theme system ──────────────────────────────────────────────────────────────

THEMES = {
    "fresh": {   # florist, grocer, organic
        "bg": "#f8fdf9", "ink": "#13241d", "muted": "#5d6b63",
        "accent": "#1f8f6a", "accent2": "#a8d5ba", "soft": "#e3f4ec",
        "font_display": "Cormorant Garamond", "font_body": "DM Sans",
        "hero_overlay": "rgba(19,36,29,0.45)",
    },
    "warm": {    # bakery, restaurant, bistro
        "bg": "#fffaf4", "ink": "#2a1d12", "muted": "#7a6a58",
        "accent": "#c2622d", "accent2": "#f0a87a", "soft": "#f8e7d8",
        "font_display": "Playfair Display", "font_body": "Source Sans 3",
        "hero_overlay": "rgba(42,29,18,0.5)",
    },
    "mono": {    # barber, tailor, repair
        "bg": "#f9f9f9", "ink": "#111111", "muted": "#555555",
        "accent": "#111111", "accent2": "#888888", "soft": "#ececec",
        "font_display": "Space Grotesk", "font_body": "Inter",
        "hero_overlay": "rgba(0,0,0,0.55)",
    },
    "bold": {    # bar, club, late-night
        "bg": "#0e0f13", "ink": "#f4f4f6", "muted": "#9a9aa6",
        "accent": "#6c5ce7", "accent2": "#a29bfe", "soft": "#1c1d29",
        "font_display": "Syne", "font_body": "Inter",
        "hero_overlay": "rgba(14,15,19,0.6)",
    },
    "elegant": { # luxury, spa, jewellery
        "bg": "#faf8f3", "ink": "#1a1612", "muted": "#7a7268",
        "accent": "#b8975a", "accent2": "#d4b896", "soft": "#f0e8d8",
        "font_display": "Cormorant Garamond", "font_body": "Jost",
        "hero_overlay": "rgba(26,22,18,0.5)",
    },
}

CATEGORY_THEME = {
    "florist": "fresh", "grocery": "fresh",
    "restaurant": "warm", "cafe": "warm", "bakery": "warm",
    "barber": "mono", "hairdresser": "mono",
    "bar": "bold",
}

# ── Shared CSS + JS injected into every page ──────────────────────────────────

def shared_assets(t: dict) -> tuple[str, str]:
    gf = f"https://fonts.googleapis.com/css2?family={t['font_display'].replace(' ','+')}" \
         f":wght@300;400;600;700&family={t['font_body'].replace(' ','+')}" \
         f":wght@300;400;500;600&display=swap"

    css = f"""
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{gf}" rel="stylesheet">
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  :root {{
    --bg:      {t['bg']};
    --ink:     {t['ink']};
    --muted:   {t['muted']};
    --accent:  {t['accent']};
    --accent2: {t['accent2']};
    --soft:    {t['soft']};
    --fd:      '{t['font_display']}', Georgia, serif;
    --fb:      '{t['font_body']}', system-ui, sans-serif;
    --ease:    cubic-bezier(0.16, 1, 0.3, 1);
    --spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
  }}
  html {{ scroll-behavior: smooth; font-size: 16px; }}
  body {{
    background: var(--bg); color: var(--ink);
    font-family: var(--fb); line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }}
  h1,h2,h3,h4 {{ font-family: var(--fd); line-height: 1.1; letter-spacing: -0.02em; }}
  h1 {{ font-size: clamp(2.4rem, 6vw, 5rem); font-weight: 400; }}
  h2 {{ font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 400; margin-bottom: 1rem; }}
  h3 {{ font-size: clamp(1.2rem, 2.5vw, 1.6rem); font-weight: 600; margin-bottom: .5rem; }}
  p  {{ color: var(--muted); max-width: 60ch; line-height: 1.75; }}
  a  {{ color: var(--accent); text-decoration: none; }}

  /* Nav */
  nav {{
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.2rem 5vw;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
    transition: background .4s;
  }}
  .nav-logo {{ font-family: var(--fd); font-size: 1.4rem; color: var(--ink); }}
  .nav-links {{ display: flex; gap: 2rem; list-style: none; }}
  .nav-links a {{
    color: var(--muted); font-size: .9rem; letter-spacing: .05em;
    text-transform: uppercase; transition: color .3s;
    position: relative;
  }}
  .nav-links a::after {{
    content: ""; position: absolute; left:0; bottom:-2px;
    width:100%; height:1px; background: var(--accent);
    transform: scaleX(0); transform-origin: left;
    transition: transform .4s var(--ease);
  }}
  .nav-links a:hover {{ color: var(--ink); }}
  .nav-links a:hover::after {{ transform: scaleX(1); }}

  /* Hero */
  .hero {{
    min-height: 100vh; display: grid; place-items: center;
    position: relative; overflow: clip; text-align: center;
    padding: 2rem 5vw;
  }}
  .hero-bg {{
    position: absolute; inset: 0; z-index: 0;
    background: linear-gradient(135deg, var(--accent) 0%, var(--ink) 100%);
    animation: gradientDrift 12s ease-in-out infinite alternate;
  }}
  @keyframes gradientDrift {{
    from {{ filter: hue-rotate(0deg); }}
    to   {{ filter: hue-rotate(15deg); }}
  }}
  .hero-bg img {{
    width:100%; height:100%; object-fit:cover; opacity:.65;
    transform: scale(1.06);
    animation: heroZoom 14s var(--ease) forwards;
  }}
  @keyframes heroZoom {{ to {{ transform: scale(1); }} }}
  .hero-overlay {{
    position: absolute; inset: 0; z-index: 1;
    background: {t['hero_overlay']};
  }}
  .hero-content {{
    position: relative; z-index: 2; color: #fff; max-width: 800px;
  }}
  .hero-eyebrow {{
    display: inline-block; font-size: .8rem; letter-spacing: .18em;
    text-transform: uppercase; color: var(--accent2);
    margin-bottom: 1.5rem; opacity: 0;
    animation: fadeUp .8s .2s var(--ease) forwards;
  }}
  .hero-content h1 {{
    color: #fff; margin-bottom: 1.5rem;
    opacity: 0; animation: fadeUp .9s .35s var(--ease) forwards;
  }}
  .hero-content p {{
    color: rgba(255,255,255,.8); max-width: 52ch; margin: 0 auto 2.5rem;
    font-size: 1.1rem;
    opacity: 0; animation: fadeUp .9s .5s var(--ease) forwards;
  }}
  .hero-cta {{
    display: inline-flex; align-items: center; gap: .5em;
    padding: 1em 2.2em; border-radius: 999px;
    background: var(--accent); color: #fff; font-weight: 600; font-size: 1rem;
    box-shadow: 0 8px 28px -8px color-mix(in srgb, var(--accent) 70%, transparent);
    transition: transform .5s var(--spring), box-shadow .5s var(--ease);
    opacity: 0; animation: fadeUp .9s .65s var(--ease) forwards;
  }}
  .hero-cta:hover {{
    color: #fff; transform: translateY(-4px);
    box-shadow: 0 18px 40px -12px color-mix(in srgb, var(--accent) 80%, transparent);
  }}
  @keyframes fadeUp {{
    from {{ opacity:0; transform: translateY(28px); }}
    to   {{ opacity:1; transform: translateY(0); }}
  }}

  /* Sections */
  section {{ padding: clamp(4rem,10vw,8rem) 5vw; }}
  .section-label {{
    font-size: .75rem; letter-spacing: .2em; text-transform: uppercase;
    color: var(--accent); margin-bottom: 1rem; display: block;
  }}
  .container {{ width: min(100%, 1100px); margin-inline: auto; }}
  .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }}
  @media (max-width: 700px) {{ .two-col {{ grid-template-columns: 1fr; gap: 2rem; }} }}

  /* Cards */
  .card-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap: 1.5rem; margin-top: 3rem; }}
  .card {{
    background: var(--soft); border-radius: 16px; padding: 2rem;
    transition: transform .5s var(--ease), box-shadow .5s var(--ease);
  }}
  .card:hover {{ transform: translateY(-8px); box-shadow: 0 24px 48px -24px rgba(0,0,0,.25); }}
  .card-icon {{ font-size: 2rem; margin-bottom: 1rem; }}

  /* Gallery */
  .gallery {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap: 1rem; margin-top: 3rem; }}
  .gallery-item {{
    border-radius: 12px; overflow: clip; aspect-ratio: 4/3;
    background: var(--soft); cursor: pointer;
    transition: transform .5s var(--ease);
  }}
  .gallery-item:hover {{ transform: scale(1.03); }}
  .gallery-item img {{
    width:100%; height:100%; object-fit:cover; display:block;
    opacity: 0; transition: opacity .6s var(--ease);
  }}
  .gallery-item img.loaded {{ opacity: 1; }}

  /* Lightbox */
  .lightbox {{
    position: fixed; inset: 0; z-index: 1000; display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,.88); padding: 4vh 4vw;
    cursor: zoom-out;
  }}
  .lightbox.open {{ display: flex; }}
  .lightbox img {{
    max-width: 100%; max-height: 100%; border-radius: 8px;
    box-shadow: 0 24px 64px -16px rgba(0,0,0,.6);
    opacity: 0; transform: scale(.96); transition: opacity .35s var(--ease), transform .35s var(--ease);
  }}
  .lightbox.open img {{ opacity: 1; transform: scale(1); }}
  .lightbox-close {{
    position: absolute; top: 1.5rem; right: 2rem;
    color: #fff; font-size: 2.4rem; line-height: 1; cursor: pointer;
    opacity: .8; transition: opacity .2s;
  }}
  .lightbox-close:hover {{ opacity: 1; }}

  /* Contact block */
  .contact-grid {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 2rem; margin-top: 3rem; }}
  .contact-card {{
    background: var(--soft); border-radius: 16px; padding: 2rem;
    display: flex; flex-direction: column; gap: .5rem;
  }}
  .contact-card .label {{ font-size:.75rem; letter-spacing:.15em; text-transform:uppercase; color:var(--accent); }}
  .contact-card .value {{ font-size:1.05rem; font-weight:600; color: var(--ink); }}

  /* Booking form */
  .booking-form {{ max-width: 640px; margin-top: 2.5rem; }}
  .form-row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 1.2rem; margin-bottom: 1.2rem; }}
  .booking-form label {{
    display: flex; flex-direction: column; gap: .4rem;
    font-size: .8rem; letter-spacing: .04em; color: var(--muted);
  }}
  .booking-form input {{
    font-family: var(--fb); font-size: 1rem; color: var(--ink);
    background: var(--bg); border: 1.5px solid color-mix(in srgb, var(--ink) 15%, transparent);
    border-radius: 10px; padding: .7em .9em; outline: none;
    transition: border-color .25s, box-shadow .25s;
  }}
  .booking-form input:focus {{
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }}
  .booking-form button {{ border: none; cursor: pointer; font-family: var(--fb); }}
  .reservation-status {{
    margin-top: 1rem; font-size: .9rem; font-weight: 600; display: none;
  }}
  .reservation-status.ok {{ display: block; color: var(--accent); }}
  .reservation-status.err {{ display: block; color: #c0392b; }}

  /* Divider */
  .divider {{ border:none; border-top: 1px solid color-mix(in srgb,var(--ink) 10%,transparent); margin: 0; }}

  /* Footer */
  footer {{
    padding: 3rem 5vw; text-align:center;
    border-top: 1px solid color-mix(in srgb,var(--ink) 8%,transparent);
    color: var(--muted); font-size:.85rem;
  }}

  /* Reveal animation (driven by JS) */
  .reveal {{
    opacity:0; transform: translateY(32px);
    transition: opacity .8s var(--ease), transform .8s var(--ease);
  }}
  .reveal.in {{ opacity:1; transform: none; }}
  .reveal.d1 {{ transition-delay:.08s; }}
  .reveal.d2 {{ transition-delay:.16s; }}
  .reveal.d3 {{ transition-delay:.24s; }}
  .reveal.d4 {{ transition-delay:.32s; }}

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {{
    *, *::before, *::after {{ animation:none !important; transition:none !important; }}
    .reveal {{ opacity:1; transform:none; }}
  }}
</style>"""

    js = """
<script>
(function(){
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches){
    document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in');});
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    },{threshold:0.12, rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  }

  // Gallery: fade images in as they load, open a lightbox on click.
  document.querySelectorAll('.gallery-item img').forEach(function(img){
    function reveal(){ img.classList.add('loaded'); }
    if(img.complete){ reveal(); } else { img.addEventListener('load', reveal); }
  });

  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = '<span class="lightbox-close">&times;</span><img>';
  document.body.appendChild(lightbox);
  var lightboxImg = lightbox.querySelector('img');

  function openLightbox(src, alt){
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('open');
  }
  function closeLightbox(){ lightbox.classList.remove('open'); }

  document.querySelectorAll('.gallery-item').forEach(function(item){
    item.addEventListener('click', function(){
      var img = item.querySelector('img');
      if(img) openLightbox(img.src, img.alt);
    });
  });
  lightbox.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeLightbox();
  });

  // Reservation form: submit to Netlify Forms via fetch, no page reload.
  var form = document.getElementById('reservation-form');
  if(form){
    var status = document.getElementById('reservation-status');
    var dateInput = form.querySelector('input[name="date"]');
    if(dateInput) dateInput.min = new Date().toISOString().split('T')[0];

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var data = new URLSearchParams(new FormData(form)).toString();
      fetch(form.getAttribute('action') || '/', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: data
      }).then(function(res){
        if(!res.ok) throw new Error('network');
        form.reset();
        status.textContent = 'Merci ! Votre demande de réservation a bien été envoyée.';
        status.className = 'reservation-status ok';
      }).catch(function(){
        status.textContent = 'Une erreur est survenue — merci de nous appeler directement.';
        status.className = 'reservation-status err';
      });
    });
  }
})();
</script>"""

    return css, js


# ── Nav helper ────────────────────────────────────────────────────────────────

def nav_html(name: str, active: str) -> str:
    pages = [("Accueil","index.html"),("Services","services.html"),
             ("Galerie","gallery.html"),("Contact","contact.html")]
    links = "\n".join(
        f'<li><a href="{url}" {"style=\"color:var(--ink)\"" if label==active else ""}>{label}</a></li>'
        for label, url in pages
    )
    return f"""
<nav>
  <a class="nav-logo" href="index.html">{name}</a>
  <ul class="nav-links">{links}</ul>
</nav>"""


# ── Page generators ───────────────────────────────────────────────────────────

def page_index(b: dict, t: dict, css: str, js: str, images: list[str]) -> str:
    hero_img = f'<img src="{images[0]}" alt="{b["name"]}" loading="eager">' if images else ""
    category_label = b.get("category", "").replace("_", " ").title()
    about_img = f'<img src="{images[1]}" alt="À propos" style="width:100%;border-radius:16px;display:block;">' if len(images) > 1 else ""
    about_text = b.get("description") or (
        f"Bienvenue chez {b['name']}, situé au {b.get('address','Paris')}. "
        f"Nous vous accueillons avec passion et savoir-faire au cœur de Paris."
    )

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{b['name']}</title>
{css}
</head>
<body>
{nav_html(b['name'], 'Accueil')}

<section class="hero">
  <div class="hero-bg">{hero_img}</div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <span class="hero-eyebrow">{category_label} · Paris</span>
    <h1>{b['name']}</h1>
    <p>Une adresse parisienne authentique, où chaque détail compte.</p>
    <a class="hero-cta" href="contact.html">Nous contacter →</a>
  </div>
</section>

<section style="background:var(--soft);">
  <div class="container two-col">
    <div class="reveal">
      <span class="section-label">Notre histoire</span>
      <h2>À propos</h2>
      <p>{about_text}</p>
      <br>
      <a href="services.html" style="font-weight:600;color:var(--accent);">Voir nos services →</a>
    </div>
    <div class="reveal d1">{about_img}</div>
  </div>
</section>

<hr class="divider">
<footer>© {b['name']} · Paris · Tous droits réservés</footer>
{js}
</body>
</html>"""


def page_services(b: dict, t: dict, css: str, js: str, category: str) -> str:
    service_map = {
        "restaurant":  [("🍽️","Déjeuner","Table d'hôte du lundi au vendredi, carte raffinée."),
                        ("🍷","Dîner","Soirées gastronomiques dans un cadre chaleureux."),
                        ("🎉","Événements","Privatisation et menus sur mesure."),
                        ("🥡","À emporter","Plats du jour disponibles à emporter.")],
        "cafe":        [("☕","Café & Boissons","Espresso, cappuccino, thés de spécialité."),
                        ("🥐","Petite restauration","Viennoiseries, tartines, salades."),
                        ("💻","Espace coworking","Wi-Fi gratuit, prises disponibles."),
                        ("🎂","Événements privés","Privatisation sur réservation.")],
        "florist":     [("💐","Bouquets","Compositions fraîches du marché."),
                        ("💍","Mariages","Décorations florales sur mesure."),
                        ("🏢","Entreprises","Abonnements fleurs pour bureaux."),
                        ("🚚","Livraison","Livraison à domicile sur Paris.")],
        "barber":      [("✂️","Coupe homme","Coupe classique ou moderne."),
                        ("🪒","Rasage","Rasage traditionnel à la serviette chaude."),
                        ("💈","Barbe","Taille et soin de la barbe."),
                        ("🧴","Soins","Produits de qualité professionnelle.")],
        "hairdresser": [("✂️","Coupe","Coupe femme, homme et enfant."),
                        ("🎨","Couleur","Balayage, teinture, highlights."),
                        ("💇","Soins","Masques, kératine, lissage."),
                        ("👰","Mariages","Coiffures de cérémonie sur mesure.")],
        "bakery":      [("🥖","Pain","Baguettes tradition, pains spéciaux."),
                        ("🥐","Viennoiseries","Croissants, pains au chocolat."),
                        ("🎂","Pâtisseries","Tartes, entremets, gâteaux de fête."),
                        ("🧁","Commandes","Gâteaux personnalisés sur commande.")],
        "grocery":     [("🥦","Fruits & Légumes","Sélection fraîche chaque matin."),
                        ("🧀","Épicerie fine","Fromages, charcuteries, conserves."),
                        ("🌿","Bio","Produits biologiques et locaux."),
                        ("🚚","Livraison","Livraison à domicile disponible.")],
    }
    menu = b.get("_menu")
    if menu:
        groups = "\n".join(f"""
    <div class="reveal d{min(i+1,4)}" style="margin-bottom:2.5rem;">
      <h3 style="color:var(--accent); margin-bottom:1rem;">{group}</h3>
      <ul style="list-style:none;">{"".join(f'<li style="display:flex; justify-content:space-between; gap:1rem; padding:.4rem 0; border-bottom:1px dashed color-mix(in srgb,var(--ink) 12%,transparent);"><span>{dish}</span><span style="color:var(--accent); font-weight:600; white-space:nowrap;">{price}</span></li>' for dish, price in dishes)}</ul>
    </div>""" for i, (group, dishes) in enumerate(menu.items()))
        main_block = f"""
    <span class="section-label reveal">Ce que nous proposons</span>
    <h2 class="reveal d1">Notre carte</h2>
    <p class="reveal d2">La carte change au gre du marche — voici les plats que vous pourrez retrouver chez {b['name']}.</p>
    <div style="max-width:700px; margin-top:3rem;">{groups}</div>"""
    else:
        services = b.get("_services") or service_map.get(category, [
            ("⭐","Service 1","Description de votre service principal."),
            ("⭐","Service 2","Description de votre deuxième service."),
            ("⭐","Service 3","Description de votre troisième service."),
            ("⭐","Service 4","Description de votre quatrième service."),
        ])
        cards = "\n".join(f"""
    <div class="card reveal d{min(i+1,4)}">
      <div class="card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>""" for i,(icon,title,desc) in enumerate(services))
        main_block = f"""
    <span class="section-label reveal">Ce que nous proposons</span>
    <h2 class="reveal d1">Nos services</h2>
    <p class="reveal d2">Découvrez tout ce que {b['name']} vous propose, avec passion et expertise.</p>
    <div class="card-grid">{cards}</div>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Services — {b['name']}</title>
{css}
</head>
<body>
{nav_html(b['name'], 'Services')}

<section style="padding-top:8rem;">
  <div class="container">{main_block}</div>
</section>

<section style="background:var(--soft); text-align:center;">
  <div class="container reveal">
    <h2>Prêt à nous rendre visite ?</h2>
    <br>
    <a class="hero-cta" href="contact.html">Nous trouver →</a>
  </div>
</section>

<footer>© {b['name']} · Paris · Tous droits réservés</footer>
{js}
</body>
</html>"""


def page_gallery(b: dict, t: dict, css: str, js: str, images: list[str]) -> str:
    items = "\n".join(
        f'<div class="gallery-item reveal d{min(i%4+1,4)}"><img src="{img}" alt="Photo {i+1}" loading="lazy"></div>'
        for i, img in enumerate(images)
    )
    if not items:
        items = '<p style="color:var(--muted)">Photos disponibles prochainement.</p>'

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Galerie — {b['name']}</title>
{css}
</head>
<body>
{nav_html(b['name'], 'Galerie')}

<section style="padding-top:8rem;">
  <div class="container">
    <span class="section-label reveal">Nos photos</span>
    <h2 class="reveal d1">Galerie</h2>
    <div class="gallery">{items}</div>
  </div>
</section>

<footer>© {b['name']} · Paris · Tous droits réservés</footer>
{js}
</body>
</html>"""


def page_contact(b: dict, t: dict, css: str, js: str) -> str:
    phone   = b.get("phone","Non renseigné")
    hours   = b.get("hours","Nous contacter pour les horaires")
    address = b.get("address","Paris")
    maps    = f"https://www.google.com/maps/search/?api=1&query={address.replace(' ','+')},+Paris"

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contact — {b['name']}</title>
{css}
</head>
<body>
{nav_html(b['name'], 'Contact')}

<section style="padding-top:8rem;">
  <div class="container">
    <span class="section-label reveal">Venez nous voir</span>
    <h2 class="reveal d1">Nous contacter</h2>
    <p class="reveal d2">Nous sommes à votre disposition. Passez nous voir ou appelez-nous directement.</p>

    <div class="contact-grid">
      <div class="contact-card reveal d1">
        <span class="label">📍 Adresse</span>
        <span class="value">{address}, Paris</span>
        <a href="{maps}" target="_blank" style="font-size:.85rem;color:var(--accent);margin-top:.5rem;">Voir sur la carte →</a>
      </div>
      <div class="contact-card reveal d2">
        <span class="label">📞 Téléphone</span>
        <span class="value">{phone}</span>
        <a href="tel:{phone.replace(' ','')}" style="font-size:.85rem;color:var(--accent);margin-top:.5rem;">Appeler →</a>
      </div>
      <div class="contact-card reveal d3">
        <span class="label">🕐 Horaires</span>
        <span class="value" style="font-size:.9rem;white-space:pre-line;">{hours}</span>
      </div>
    </div>
  </div>
</section>

<section style="background:var(--soft);">
  <div class="container">
    <span class="section-label reveal">Réservation</span>
    <h2 class="reveal d1">Demander une table</h2>
    <p class="reveal d2">Remplissez ce formulaire et nous vous recontacterons pour confirmer votre réservation.</p>

    <form name="reservation" id="reservation-form" method="POST" data-netlify="true" netlify-honeypot="bot-field" class="reveal d3 booking-form">
      <input type="hidden" name="form-name" value="reservation">
      <p style="display:none;"><label>Ne pas remplir : <input name="bot-field"></label></p>

      <div class="form-row">
        <label>Nom complet
          <input type="text" name="name" required>
        </label>
        <label>Téléphone
          <input type="tel" name="phone" required>
        </label>
      </div>
      <div class="form-row">
        <label>Date
          <input type="date" name="date" required>
        </label>
        <label>Heure
          <input type="time" name="time" required>
        </label>
        <label>Nombre de personnes
          <input type="number" name="guests" min="1" max="30" value="2" required>
        </label>
      </div>

      <button type="submit" class="hero-cta">Envoyer la demande →</button>
      <p id="reservation-status" class="reservation-status"></p>
    </form>
  </div>
</section>

<section>
  <div class="container" style="text-align:center;">
    <div class="reveal">
      <h2>Une question ?</h2>
      <p style="margin:.8rem auto 2rem;">N'hésitez pas à nous appeler ou à passer directement en boutique.</p>
      <a class="hero-cta" href="tel:{phone.replace(' ','')}">Appeler maintenant</a>
    </div>
  </div>
</section>

<footer>© {b['name']} · Paris · Tous droits réservés</footer>
{js}
</body>
</html>"""


# ── Entry point ───────────────────────────────────────────────────────────────

def build(business: dict, theme_key: str = None, images: list[str] = None, out_dir: str = None) -> str:
    name     = business["name"]
    category = business.get("category", "restaurant")
    safe     = re.sub(r"[^a-z0-9]", "_", name.lower())
    out      = out_dir or f"sites/{safe}"
    Path(out).mkdir(parents=True, exist_ok=True)

    # Pick theme
    if not theme_key or theme_key not in THEMES:
        theme_key = CATEGORY_THEME.get(category, "warm")
    t = THEMES[theme_key]

    imgs = images or []
    css, js = shared_assets(t)

    (Path(out) / "index.html").write_text(page_index(business, t, css, js, imgs), encoding="utf-8")
    (Path(out) / "services.html").write_text(page_services(business, t, css, js, category), encoding="utf-8")
    (Path(out) / "gallery.html").write_text(page_gallery(business, t, css, js, imgs), encoding="utf-8")
    (Path(out) / "contact.html").write_text(page_contact(business, t, css, js), encoding="utf-8")

    print(f"✅ Site built → {out}/index.html")
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--business", type=str, help="JSON string of business dict")
    parser.add_argument("--theme", type=str, default=None, help="Theme: fresh/warm/mono/bold/elegant")
    parser.add_argument("--images", type=str, default="[]", help="JSON list of image URLs")
    parser.add_argument("--out", type=str, default=None, help="Output directory")
    args = parser.parse_args()

    if args.business:
        b = json.loads(args.business)
        imgs = json.loads(args.images)
        build(b, theme_key=args.theme, images=imgs, out_dir=args.out)
    else:
        # Demo mode
        demo = {"name":"Le Petit Marché","category":"restaurant",
                "address":"12 Rue de Bretagne","city":"Paris",
                "phone":"+33 1 42 00 00 00","hours":"Lun–Ven 12h–22h"}
        build(demo, theme_key="warm")
