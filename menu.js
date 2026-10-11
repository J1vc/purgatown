// Edita aquí nombres, descripciones y precios. Mantén [descripcion] hasta tener el texto aprobado.
    const PRONTO = 'Próximamente';
    const carta = [
      { id:'bebidas', titulo:'Bebidas', color:'bebidas', grupos:[
        { titulo:'Cervezas', items:[
          { n:'Costeña Verde', d:'[descripcion]', p:PRONTO },
          { n:'Budweiser', d:'[descripcion]', p:PRONTO },
          { n:'Cubetazo Costeña Verde', d:'[descripcion]', p:PRONTO },
          { n:'Cubetazo Budweiser', d:'[descripcion]', p:PRONTO }
        ]},
        { titulo:'Tragos', items:[
          { n:'Aguardiente', d:'[descripcion]', p:PRONTO },
          { n:'Smirnoff', d:'[descripcion]', p:PRONTO }
        ]},
        { titulo:'Sin alcohol', items:[
          { n:'Gaseosas', d:'[descripcion]', p:PRONTO },
          { n:'Agua', d:'[descripcion]', p:PRONTO },
          { n:'Electrolit', d:'[descripcion]', p:PRONTO }
        ]}
      ]},
      { id:'comidas', titulo:'Comidas', color:'comidas', grupos:[
        { titulo:'', items:[ { n:'Picadas Silv Grill', d:'[descripcion]', p:PRONTO } ] }
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
          article.innerHTML = `<div class="row"><span class="name"></span><span class="dots" aria-hidden="true"></span><span class="price"></span></div><p class="desc"></p>`;
          article.querySelector('.name').textContent = item.n;
          article.querySelector('.price').textContent = item.p;
          article.querySelector('.desc').textContent = item.d;
          section.appendChild(article);
        });
      });
      main.appendChild(section);
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
