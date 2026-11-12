export const burgerfit = {
  name: "Burgerfit",
  slogan: "Sabor que te pone en forma.",
  instagram: {
    handle: "@b.urgerfit",
    url: "https://www.instagram.com/b.urgerfit/",
  },
  product: {
    name: "Hamburguesa Burgerfit",
    price: "$2.000",
    ingredients: [
      "Carne",
      "Queso",
      "Lechuga",
      "Tomate",
      "Mayonesa",
      "Pan de hamburguesa",
    ],
  },
  promotions: [
    { quantity: 3, price: "$5.500" },
    { quantity: 5, price: "$8.500" },
  ],
  payments: ["Efectivo", "Transferencia bancaria", "Mercado Pago"],
  delivery: [
    "Las preparamos en casa el mismo día de la venta.",
    "Entregas directas y en el colegio durante los recreos.",
    "Repartimos en distintos puntos de la ciudad mediante motos.",
  ],
  images: {
    mascot: "/images/logo/burgerfit-mascota.jpeg",
    instagramLogo: "/images/logo/burgerfit-instagram.jpeg",
    currentPromo: "/images/promotions/combos-vigentes.jpeg",
    sloganArtwork: "/images/promotions/sabor-en-forma.jpeg",
  },
} as const;
