<script setup lang="ts">
useHead({ title: 'Aviso de Privacidad — Film Logger' })
</script>

<template>
  <article class="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
    <h1>Aviso de Privacidad Integral</h1>
    <p><strong>Última actualización:</strong> 26 de abril de 2026</p>

    <h2>1. Identidad y domicilio del Responsable</h2>
    <p>
      [NOMBRE LEGAL DEL RESPONSABLE], con domicilio en
      [DOMICILIO COMPLETO EN MÉXICO O DE CONTACTO], en lo sucesivo "el
      Responsable" u "Film Logger", es responsable del tratamiento de tus datos
      personales conforme a la Ley Federal de Protección de Datos Personales en
      Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos
      del Aviso de Privacidad.
    </p>
    <p>
      Para cualquier asunto relacionado con tus datos personales, puedes
      contactarnos en:
      <strong>[CORREO ELECTRÓNICO DEL DEPARTAMENTO DE DATOS PERSONALES]</strong>.
    </p>

    <h2>2. Datos personales que recabamos</h2>
    <p>
      Recabamos únicamente los datos personales necesarios para que la
      aplicación funcione. <strong>No recabamos datos personales sensibles</strong>
      en términos del artículo 3, fracción VI de la LFPDPPP.
    </p>

    <h3>2.1 Datos visibles para el Responsable (almacenados sin cifrar)</h3>
    <ul>
      <li>
        <strong>Datos de cuenta:</strong> nombre de usuario que tú eliges y un
        <em>hash</em> irreversible de tu contraseña (nunca almacenamos tu
        contraseña en claro).
      </li>
      <li>
        <strong>Datos de catálogo fotográfico:</strong> marcas y modelos de
        cámaras, lentes y películas que registras, así como ISO, formato,
        número de cuadros y costo del rollo.
      </li>
      <li>
        <strong>Metadatos técnicos de cada toma:</strong> número de cuadro,
        fecha y hora de captura, apertura, velocidad de obturación y referencia
        al lente utilizado.
      </li>
      <li>
        <strong>Información de laboratorios fotográficos:</strong> nombre,
        dirección, teléfono y sitio web que tú decidas registrar.
      </li>
      <li>
        <strong>Datos operativos de seguridad:</strong> registros de intentos
        de inicio de sesión (nombre de usuario y hora) con la finalidad
        exclusiva de prevenir ataques de fuerza bruta.
      </li>
      <li>
        <strong>Cookie de sesión:</strong> una cookie estrictamente necesaria,
        segura y <code>HttpOnly</code>, con vigencia de 30 días, que mantiene
        tu sesión iniciada. No utilizamos cookies de análisis ni de publicidad.
      </li>
    </ul>

    <h3>2.2 Datos cifrados de extremo a extremo (NO visibles para el Responsable)</h3>
    <p>
      Los siguientes datos se cifran en tu dispositivo <strong>antes</strong>
      de enviarse a nuestros servidores. El Responsable y cualquier tercero,
      incluido nuestro proveedor de infraestructura,
      <strong>no pueden leerlos bajo ninguna circunstancia</strong>:
    </p>
    <ul>
      <li>
        <strong>Notas personales</strong> asociadas a cualquier toma, rollo,
        cámara, lente o laboratorio.
      </li>
      <li>
        <strong>Ubicación geográfica precisa</strong> de cada toma (latitud,
        longitud, exactitud y, en su caso, el texto descriptivo del lugar)
        cuando autorizas el acceso a la geolocalización del dispositivo.
      </li>
    </ul>

    <h2>3. Finalidades del tratamiento</h2>
    <p>
      Tratamos tus datos personales <strong>únicamente para finalidades
      primarias y necesarias</strong> para prestarte el servicio:
    </p>
    <ol>
      <li>Crear y mantener tu cuenta y autenticarte de forma segura.</li>
      <li>
        Permitirte registrar, consultar, modificar y eliminar tu inventario
        fotográfico (cámaras, lentes, películas, rollos, tomas, laboratorios).
      </li>
      <li>Sincronizar tu información entre tus dispositivos.</li>
      <li>Habilitar el cifrado de extremo a extremo de tus notas y ubicaciones.</li>
      <li>Prevenir accesos no autorizados y abusos al servicio.</li>
    </ol>
    <p>
      <strong>No realizamos ningún tratamiento con finalidades secundarias.</strong>
      No usamos tus datos para mercadotecnia, prospección comercial,
      publicidad, elaboración de perfiles, decisiones automatizadas con efectos
      jurídicos para ti, ni los vendemos, alquilamos o cedemos a terceros con
      fines comerciales.
    </p>

    <h2>4. Cómo protegemos tus notas y ubicaciones (cifrado de extremo a extremo)</h2>
    <p>
      Aplicamos un esquema de <strong>cero conocimiento</strong>
      ("zero-knowledge") sobre tus notas y ubicaciones precisas:
    </p>
    <ul>
      <li><strong>Algoritmo:</strong> AES-GCM con clave de 256 bits.</li>
      <li>
        <strong>Derivación de la clave:</strong> PBKDF2-SHA256 con 200,000
        iteraciones, usando tu contraseña y una sal aleatoria de 16 bytes
        generada al momento del registro y única por cuenta.
      </li>
      <li>
        <strong>Almacenamiento de la clave:</strong> la clave derivada se
        conserva exclusivamente en tu navegador (IndexedDB) marcada como
        <strong>no exportable</strong> por la API Web Crypto del navegador, lo
        que impide que cualquier código —incluido el nuestro— pueda leer sus
        bytes.
      </li>
      <li>
        <strong>Proceso:</strong> el cifrado y descifrado ocurren íntegramente
        en tu dispositivo. A nuestro servidor solo viajan y se almacenan los
        textos cifrados (base64).
      </li>
      <li>
        <strong>Vector de inicialización (IV):</strong> se genera uno aleatorio
        de 12 bytes por cada cifrado, garantizando que dos cifrados del mismo
        texto produzcan resultados distintos.
      </li>
    </ul>
    <blockquote>
      <strong>Advertencia importante:</strong> dado que ni el Responsable ni
      nadie más posee tu clave, <strong>si olvidas tu contraseña, tus notas y
      ubicaciones cifradas serán irrecuperables</strong>. El código de
      recuperación que te entregamos al registrarte sirve para recuperar el
      acceso a tu cuenta, pero <strong>no recupera el contenido cifrado</strong>.
      Te recomendamos guardar tu contraseña en un gestor seguro.
    </blockquote>

    <h2>5. Transferencias y remisiones</h2>
    <p>
      <strong>No transferimos tus datos personales a terceros con fines
      comerciales, publicitarios ni de elaboración de perfiles.</strong>
    </p>
    <p>
      Para operar el servicio, utilizamos a <strong>Cloudflare, Inc.</strong>
      (Estados Unidos de América) como <strong>encargado</strong> del
      tratamiento (figura de "remisión" prevista en el artículo 50 del
      Reglamento de la LFPDPPP), quien aloja la infraestructura de cómputo,
      base de datos (Cloudflare D1) y red de distribución global. Cloudflare
      procesa los datos exclusivamente bajo nuestras instrucciones, conforme a
      los términos de su Data Processing Addendum, y no los utiliza para
      finalidades propias. Por la naturaleza global de su red, los datos pueden
      replicarse en distintos centros de datos, principalmente en los Estados
      Unidos.
    </p>
    <p>
      Únicamente revelaremos tus datos a terceros distintos de Cloudflare
      cuando exista una <strong>obligación legal</strong>, una <strong>orden de
      autoridad competente</strong>, o cuando sea estrictamente necesario para
      defendernos en un procedimiento judicial, conforme a los artículos 37 y
      70 de la LFPDPPP.
    </p>

    <h2>6. Conservación de los datos</h2>
    <p>
      Conservamos tus datos personales mientras tu cuenta permanezca activa.
      Si eliminas tu cuenta o ejerces tu derecho de cancelación, eliminaremos
      tus datos de nuestras bases de producción dentro de los <strong>30 días
      naturales</strong> siguientes, salvo el periodo adicional de conservación
      en respaldos cifrados y registros de seguridad que la propia ley permite
      (hasta 12 meses) y los datos que debamos conservar por obligación legal.
    </p>

    <h2>7. Tus derechos ARCO y revocación del consentimiento</h2>
    <p>
      Tienes derecho a <strong>Acceder, Rectificar, Cancelar u Oponerte</strong>
      al tratamiento de tus datos personales (derechos ARCO), así como a
      <strong>revocar tu consentimiento</strong> en cualquier momento. La
      mayoría de estos derechos puedes ejercerlos directamente desde la
      aplicación: editar o borrar tus registros, exportar tus datos o eliminar
      tu cuenta desde la sección de <strong>Configuración</strong>.
    </p>
    <p>
      Adicionalmente, puedes presentar tu solicitud por escrito al correo
      <strong>[CORREO ELECTRÓNICO DEL DEPARTAMENTO DE DATOS PERSONALES]</strong>,
      indicando:
    </p>
    <ol>
      <li>Tu nombre y un medio para recibir respuesta.</li>
      <li>
        Documentos que acrediten tu identidad (o, en su caso, la representación
        legal).
      </li>
      <li>
        La descripción clara de los datos sobre los que pretendes ejercer el
        derecho.
      </li>
      <li>Cualquier otro elemento que facilite la localización de los datos.</li>
    </ol>
    <p>
      Daremos respuesta en un plazo máximo de <strong>20 días hábiles</strong>
      y, en su caso, haremos efectiva la determinación dentro de los
      <strong>15 días hábiles</strong> siguientes, conforme a los artículos 28
      a 32 de la LFPDPPP. Si consideras que tu derecho fue vulnerado, puedes
      acudir a la autoridad competente (actualmente la <strong>Secretaría
      Anticorrupción y Buen Gobierno</strong>, sucesora del INAI a partir de
      2025).
    </p>

    <h2>8. Uso de cookies y tecnologías similares</h2>
    <p>
      La aplicación utiliza únicamente <strong>una cookie estrictamente
      necesaria</strong> para mantener tu sesión iniciada (<code>HttpOnly</code>,
      <code>Secure</code>, <code>SameSite=Lax</code>, vigencia 30 días). No
      empleamos cookies de análisis, publicidad, <em>fingerprinting</em> ni
      <em>web beacons</em> de terceros. Puedes deshabilitar las cookies desde
      la configuración de tu navegador, pero en tal caso no podrás iniciar
      sesión.
    </p>
    <p>
      Almacenamos también, en el <code>IndexedDB</code> y <code>localStorage</code>
      de tu navegador, datos técnicos necesarios para el funcionamiento sin
      conexión y para conservar tu clave de cifrado no exportable; estos datos
      <strong>no salen de tu dispositivo</strong>.
    </p>

    <h2>9. Cambios al Aviso de Privacidad</h2>
    <p>
      Cualquier modificación a este Aviso será publicada en esta misma página,
      con actualización de la fecha de "Última actualización". Si los cambios
      son sustanciales, te lo notificaremos al iniciar sesión y, en la medida
      de lo posible, al correo asociado a tu cuenta.
    </p>

    <hr>

    <p class="text-sm italic">
      Este Aviso de Privacidad se rige por las leyes de los Estados Unidos
      Mexicanos. La versión en español es la única auténtica.
    </p>
  </article>
</template>
