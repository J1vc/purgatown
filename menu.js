// Edita aquí los nombres y precios de la carta.
    const PRONTO = 'Próximamente';
    const carta = [
      { id:'bebidas', titulo:'Bebidas', color:'bebidas', grupos:[
        { titulo:'Cervezas', items:[
          { n:'Costeña Verde', p:PRONTO },
          { n:'Budweiser', p:PRONTO },
          { n:'Cubetazo Costeña Verde', p:PRONTO },
          { n:'Cubetazo Budweiser', p:PRONTO }
        ]},
        { titulo:'Tragos', items:[
          { n:'Aguardiente', p:PRONTO },
          { n:'Smirnoff', p:PRONTO }
        ]},
        { titulo:'Sin alcohol', items:[
          { n:'Gaseosas', p:PRONTO },
          { n:'Agua', p:PRONTO },
          { n:'Electrolit', p:PRONTO }
        ]}
      ]},
      { id:'comidas', titulo:'Comidas', color:'comidas', grupos:[
        { titulo:'', items:[ { n:'Picadas Silv Grill', p:PRONTO } ] }
      ]}
    ];
    const main = document.getElementById('carta');
    const chips = document.getElementById('chips');
    carta.forEach(cat => {
      const link = document.createElement('a');
      link.href = `#${cat.id}`; link.textContent = cat.titulo; link.dataset.id = cat.id;
      chips.appendChild(link);
      const section = document.createElement('section');
      section.id = cat.id; section.className = `category ${cat.color}`;
      section.innerHTML = `<h2>${cat.titulo}</h2><hr class="rule">`;
      cat.grupos.forEach(group => {
        if (group.titulo) {
          const heading = document.createElement('h3'); heading.className = 'group'; heading.textContent = group.titulo; section.appendChild(heading);
        }
        group.items.forEach(item => {
          const article = document.createElement('article'); article.className = 'item';
          article.innerHTML = `<div class="row"><span class="name"></span><span class="dots" aria-hidden="true"></span><span class="price"></span></div>`;
          article.querySelector('.name').textContent = item.n;
          // Próximamente: etiqueta Pronto. Un precio real sigue usando el formato habitual.
          const price = article.querySelector('.price');
          if (item.p === PRONTO) {
            price.className = 'pronto-tag';
            price.textContent = 'Pronto';
          } else {
            price.textContent = item.p;
          }
          section.appendChild(article);
        });
      });
      main.appendChild(section);
    });
    // Próximamente: parpadeo al azar de las etiquetas Pronto
    document.querySelectorAll('.pronto-tag').forEach(tag => {
      tag.style.animationDuration = `${(3 + Math.random() * 5).toFixed(2)}s`;
      tag.style.animationDelay = `-${(Math.random() * 8).toFixed(2)}s`;
    });
    // Resalta la categoría visible y mantiene su enlace a la vista en móvil.
    const links = [...chips.querySelectorAll('a')];
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        links.forEach(link => link.classList.toggle('active', link.dataset.id === entry.target.id));
        const active = chips.querySelector('.active');
        if (active) chips.scrollTo({ left:active.offsetLeft - 24, behavior:'smooth' });
      }), { rootMargin:'-35% 0px -55% 0px' });
      document.querySelectorAll('.category').forEach(section => observer.observe(section));
    }
