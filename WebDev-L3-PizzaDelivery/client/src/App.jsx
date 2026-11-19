import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, money } from "./api.js";

const categoryLabels = {
  base: "Choose your base",
  sauce: "Pick a sauce",
  cheese: "Add your cheese",
  vegetable: "Finish with toppings"
};
const statusLabels = {
  awaiting_payment: "Awaiting payment",
  order_received: "Order received",
  in_kitchen: "In the kitchen",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled"
};
const statusNext = {
  order_received: "in_kitchen",
  in_kitchen: "out_for_delivery",
  out_for_delivery: "delivered"
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPage = location.pathname.startsWith("/admin");
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState({ ingredients: [], pizzas: [] });
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [custom, setCustom] = useState({ baseId: "", sauceId: "", cheeseId: "", vegetableIds: [] });
  const [quantity, setQuantity] = useState(1);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [verificationLink, setVerificationLink] = useState("");
  const [inventory, setInventory] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);

  const ingredientById = useMemo(
    () => new Map(catalog.ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [catalog.ingredients]
  );
  const cartTotal = useMemo(() => cart.reduce((total, item) => {
    const components = [item.baseId, item.sauceId, item.cheeseId, ...item.vegetableIds]
      .map((id) => ingredientById.get(id));
    if (components.some((ingredient) => !ingredient)) return total;
    return total + components.reduce((sum, ingredient) => sum + ingredient.pricePaise, 0) * item.quantity;
  }, 0), [cart, ingredientById]);

  const loadOrders = useCallback(async () => {
    const result = await api("/api/orders/mine");
    setOrders(result.orders);
  }, []);

  useEffect(() => {
    let active = true;
    api("/api/catalog").then((result) => {
      if (!active) return;
      setCatalog(result);
      setCustom((current) => ({
        ...current,
        baseId: current.baseId || result.ingredients.find((item) => item.category === "base" && item.available)?.id || "",
        sauceId: current.sauceId || result.ingredients.find((item) => item.category === "sauce" && item.available)?.id || "",
        cheeseId: current.cheeseId || result.ingredients.find((item) => item.category === "cheese" && item.available)?.id || ""
      }));
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    });
    api("/api/auth/me").then((result) => {
      if (active) setUser(result.user);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verificationToken = params.get("verify");
    if (!verificationToken) return;
    setBusy(true);
    api("/api/auth/verify-email", { method: "POST", body: { token: verificationToken } })
      .then((result) => {
        setNotice(result.message);
        setAuthMode("login");
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => {
        setBusy(false);
        navigate(location.pathname, { replace: true });
      });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!user || user.role !== "user") return undefined;
    const refresh = () => loadOrders().catch((requestError) => setError(requestError.message));
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, [user, loadOrders]);

  useEffect(() => {
    if (!isAdminPage || user?.role !== "admin") return;
    Promise.all([api("/api/admin/inventory"), api("/api/admin/orders")])
      .then(([inventoryResult, orderResult]) => {
        setInventory(inventoryResult.ingredients);
        setAdminOrders(orderResult.orders);
      })
      .catch((requestError) => setError(requestError.message));
  }, [isAdminPage, user]);

  function clearMessages() {
    setError("");
    setNotice("");
    setVerificationLink("");
  }

  async function handleAuth(event) {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(data.entries());
    try {
      if (authMode === "forgot") {
        const result = await api("/api/auth/forgot-password", { method: "POST", body: { email: values.email } });
        setNotice(result.message);
        setVerificationLink(result.developmentLink || "");
      } else if (authMode === "verify") {
        const result = await api("/api/auth/verify-resend", { method: "POST", body: { email: values.email } });
        setNotice(result.message);
        setVerificationLink(result.developmentLink || "");
      } else if (authMode === "reset") {
        const token = new URLSearchParams(location.search).get("reset");
        const result = await api("/api/auth/reset-password", {
          method: "POST",
          body: { token, password: values.password }
        });
        setNotice(result.message);
        setAuthMode("login");
        navigate(location.pathname, { replace: true });
      } else if (authMode === "register") {
        const result = await api("/api/auth/register", {
          method: "POST",
          body: { username: values.username, email: values.email, password: values.password }
        });
        setNotice(result.message);
        setVerificationLink(result.developmentLink || "");
        setAuthMode("verify");
      } else {
        const endpoint = isAdminPage ? "/api/auth/admin/login" : "/api/auth/login";
        const body = isAdminPage
          ? { email: values.email, password: values.password }
          : { identifier: values.identifier, password: values.password };
        const result = await api(endpoint, { method: "POST", body });
        setUser(result.user);
        setNotice(`Welcome${result.user.username ? `, ${result.user.username}` : ""}.`);
        if (result.user.role === "user") loadOrders().catch((requestError) => setError(requestError.message));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setOrders([]);
      setAdminOrders([]);
      setNotice("You have signed out.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function addPizza(selection, name) {
    if (!selection) return;
    setCart((current) => [...current, {
      ...selection,
      vegetableIds: [...selection.vegetableIds],
      quantity: selection.quantity || 1,
      name
    }]);
    setNotice(`${name} added to your bag.`);
    setError("");
  }

  function addCustomPizza(event) {
    event.preventDefault();
    if (!custom.baseId || !custom.sauceId || !custom.cheeseId) {
      setError("Choose an available base, sauce, and cheese to build your pizza.");
      return;
    }
    addPizza({ ...custom, vegetableIds: custom.vegetableIds, quantity }, "Your custom pizza");
  }

  function updateCartItem(index, patch) {
    setCart((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item));
  }

  async function startCheckout() {
    clearMessages();
    if (!user) {
      setNotice("Sign in to place your order.");
      setAuthMode("login");
      return;
    }
    if (!user.emailVerified) {
      setError("Verify your email address before ordering.");
      return;
    }
    if (!cart.length) {
      setError("Add a pizza to your bag first.");
      return;
    }
    setBusy(true);
    try {
      const { order } = await api("/api/orders", {
        method: "POST",
        body: { items: cart.map(({ name, ...item }) => item) }
      });
      const checkout = await api(`/api/payments/${order._id}/checkout`, { method: "POST", body: {} });
      setCheckoutOrder({ ...order, checkout });
      if (checkout.mode === "razorpay") {
        await openRazorpayCheckout(order, checkout);
      } else {
        setNotice("Test checkout is ready. Complete the clearly labeled demo payment below.");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function resumePayment(order) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const checkout = await api(`/api/payments/${order._id}/checkout`, { method: "POST", body: {} });
      setCheckoutOrder({ ...order, checkout });
      document.getElementById("bag")?.scrollIntoView({ behavior: "smooth" });
      if (checkout.mode === "razorpay") await openRazorpayCheckout(order, checkout);
      else setNotice("Test checkout is ready. Complete the clearly labeled demo payment from your bag.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(order) {
    setBusy(true);
    try {
      const { order: cancelled } = await api(`/api/orders/${order._id}/cancel`, { method: "POST", body: {} });
      await finishPayment(cancelled);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function openRazorpayCheckout(order, checkout) {
    try {
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Could not load the Razorpay checkout script."));
          document.body.appendChild(script);
        });
      }
      const widget = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: "Pizza Studio",
        description: `Order ${String(order._id).slice(-8)}`,
        order_id: checkout.razorpayOrderId,
        handler: async (payment) => {
          try {
            const result = await api(`/api/payments/${order._id}/razorpay/verify`, {
              method: "POST",
              body: payment
            });
            await finishPayment(result.order);
          } catch (requestError) {
            setError(requestError.message);
          }
        },
        modal: {
          ondismiss: () => setNotice("Checkout closed. You can retry payment or cancel the pending order from order tracking.")
        },
        theme: { color: "#e65332" }
      });
      widget.open();
    } catch (requestError) {
      setError(requestError.message);
      try {
        await api(`/api/orders/${order._id}/cancel`, { method: "POST", body: {} });
      } catch (cancelError) {
        setError(`${requestError.message} ${cancelError.message}`);
      }
    }
  }

  async function finishPayment(order) {
    setCheckoutOrder({ ...order, checkout: null });
    if (order.status !== "cancelled") setCart([]);
    setNotice(order.status === "cancelled" ? "The unpaid order was cancelled and its ingredients were returned to inventory." : "Payment received. Your order is on its way!");
    await loadOrders().catch((requestError) => setError(requestError.message));
  }

  async function completeDemoPayment() {
    if (!checkoutOrder) return;
    setBusy(true);
    try {
      const { order } = await api(`/api/payments/${checkoutOrder._id}/demo-success`, { method: "POST", body: {} });
      await finishPayment(order);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelPendingOrder() {
    if (!checkoutOrder) return;
    setBusy(true);
    try {
      const { order } = await api(`/api/orders/${checkoutOrder._id}/cancel`, { method: "POST", body: {} });
      await finishPayment(order);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveInventory(ingredient) {
    setError("");
    setNotice("");
    try {
      const { ingredient: updated } = await api(`/api/admin/inventory/${ingredient._id}`, {
        method: "PATCH",
        body: { stock: Number(ingredient.stock), lowStockThreshold: Number(ingredient.lowStockThreshold), active: ingredient.active }
      });
      setInventory((current) => current.map((item) => item._id === updated._id ? updated : item));
      setNotice(`${updated.name} inventory saved.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function advanceOrder(order) {
    const nextStatus = statusNext[order.status];
    if (!nextStatus) return;
    try {
      const { order: updated } = await api(`/api/admin/orders/${order._id}/status`, {
        method: "PATCH",
        body: { status: nextStatus }
      });
      setAdminOrders((current) => current.map((item) => item._id === updated._id ? { ...item, status: updated.status } : item));
      setNotice(`Order updated: ${statusLabels[updated.status]}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const resetPasswordToken = new URLSearchParams(location.search).get("reset");
  const visibleAuthMode = resetPasswordToken ? "reset" : authMode;

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Pizza Studio home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>pizza<span className="brand-accent">studio</span><small>FRESH, YOUR WAY</small></span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="/#menu">The menu</a>
          <a href="/#build">Build a pizza</a>
          <a href="/#orders">Order tracking</a>
          <Link to="/admin">Admin</Link>
        </nav>
        <div className="header-actions">
          {user ? <><span className="user-greeting">{user.username}</span><button className="button button-quiet" onClick={logout}>Sign out</button></> :
            <a className="button button-dark" href="/#account">Sign in</a>}
          <a className="bag-link" href="/#bag" aria-label={`Shopping bag, ${cart.length} items`}>
            Bag <span>{cart.length}</span>
          </a>
        </div>
      </header>

      <main>
        {notice && <div className="message message-success" role="status">{notice}{verificationLink && <a href={verificationLink}> Open development link</a>}</div>}
        {error && <div className="message message-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

        {isAdminPage ? (
          <AdminPage
            user={user}
            authMode="login"
            onAuth={handleAuth}
            busy={busy}
            error={error}
            notice={notice}
            setAuthMode={setAuthMode}
            inventory={inventory}
            setInventory={setInventory}
            orders={adminOrders}
            saveInventory={saveInventory}
            advanceOrder={advanceOrder}
          />
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow"><span className="eyebrow-dot" /> MADE FRESH, JUST FOR YOU</p>
                <h1>A little more<br />you in <em>every slice.</em></h1>
                <p className="hero-description">Choose your crust, layer on the good stuff, and make tonight taste like your kind of night.</p>
                <div className="hero-actions">
                  <a className="button button-orange" href="#build">Build your pizza <span aria-hidden="true">↗</span></a>
                  <a className="text-link" href="#menu">Explore the menu <span aria-hidden="true">↓</span></a>
                </div>
                <div className="hero-notes"><span>✳ 100% made to order</span><span>✳ Ingredients you can pronounce</span></div>
              </div>
              <div className="hero-art" aria-label="Illustration of a fresh pizza" role="img">
                <div className="art-sun" />
                <div className="art-caption">THE GOOD<br />STUFF IS<br /><em>ON TOP.</em></div>
                <div className="pizza-plate"><div className="pizza">
                  <span className="topping topping-one" /><span className="topping topping-two" />
                  <span className="topping topping-three" /><span className="topping topping-four" />
                  <span className="topping topping-five" /><span className="topping topping-six" />
                  <span className="topping topping-seven" /><span className="topping topping-eight" />
                  <span className="pizza-leaf leaf-one" /><span className="pizza-leaf leaf-two" />
                </div></div>
                <div className="art-stamp">GOOD<br />FOOD<br /><span>GOOD</span><br />MOOD</div>
              </div>
            </section>

            <section className="intro-strip" aria-label="Why Pizza Studio">
              <span>01 <b>Pick your base</b></span><i>✳</i><span>02 <b>Choose your flavor</b></span><i>✳</i><span>03 <b>Make it yours</b></span><i>✳</i><span>04 <b>Enjoy every bite</b></span>
            </section>

            <section className="section menu-section" id="menu">
              <div className="section-heading">
                <div><p className="eyebrow">THE CROWD-PLEASERS</p><h2>Start with a <em>favorite.</em></h2></div>
                <p>Good things, already together.<br />Make them yours with a little extra.</p>
              </div>
              <div className="menu-grid">
                {catalog.pizzas.map((pizza, index) => (
                  <article className="menu-card" key={pizza.id}>
                    <div className={`menu-card-art menu-art-${index + 1}`}>
                      <span className="menu-number">0{index + 1}</span><span className="mini-pizza">{index % 2 ? "●" : "✳"}</span>
                      <span className="menu-card-tag">{pizza.available ? "A STUDIO FAVORITE" : "TEMPORARILY UNAVAILABLE"}</span>
                    </div>
                    <div className="menu-card-body">
                      <div className="menu-title-row"><h3>{pizza.name}</h3><span>{money(pizza.pricePaise)}</span></div>
                      <p>{pizza.description}</p>
                      <button className="add-link" disabled={!pizza.available} onClick={() => addPizza(pizza.selection, pizza.name)}>
                        {pizza.available ? "Add to bag" : "Sold out"} <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </article>
                ))}
                {!catalog.pizzas.length && <p className="muted">Loading the menu…</p>}
              </div>
            </section>

            <section className="custom-section" id="build">
              <div className="custom-layout">
                <div className="custom-aside">
                  <p className="eyebrow">THE FUN PART</p>
                  <h2>Your pizza.<br /><em>Your rules.</em></h2>
                  <p>Start from scratch and make a combo that feels like you. Every ingredient is priced by the piece—no surprises, just good choices.</p>
                  <div className="custom-annotation"><span>✳</span> YOUR<br />CREATION<br />STARTS HERE</div>
                </div>
                <form className="customizer" onSubmit={addCustomPizza}>
                  {["base", "sauce", "cheese"].map((category, step) => (
                    <fieldset className="ingredient-step" key={category}>
                      <legend><span className="step-count">0{step + 1}</span>{categoryLabels[category]}</legend>
                      <div className="choice-grid">
                        {catalog.ingredients.filter((item) => item.category === category).map((ingredient) => (
                          <label className={`choice ${!ingredient.available ? "choice-disabled" : ""}`} key={ingredient.id}>
                            <input
                              type="radio"
                              name={category}
                              value={ingredient.id}
                              checked={custom[`${category}Id`] === ingredient.id}
                              disabled={!ingredient.available}
                              onChange={() => setCustom((current) => ({ ...current, [`${category}Id`]: ingredient.id }))}
                            />
                            <span>{ingredient.name}</span><small>{money(ingredient.pricePaise)}</small>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <fieldset className="ingredient-step">
                    <legend><span className="step-count">04</span>{categoryLabels.vegetable}</legend>
                    <p className="field-note">Pick as many as you like (up to 8).</p>
                    <div className="choice-grid choice-grid-toppings">
                      {catalog.ingredients.filter((item) => item.category === "vegetable").map((ingredient) => (
                        <label className={`choice ${!ingredient.available ? "choice-disabled" : ""}`} key={ingredient.id}>
                          <input
                            type="checkbox"
                            checked={custom.vegetableIds.includes(ingredient.id)}
                            disabled={!ingredient.available || (custom.vegetableIds.length >= 8 && !custom.vegetableIds.includes(ingredient.id))}
                            onChange={(event) => setCustom((current) => ({
                              ...current,
                              vegetableIds: event.target.checked
                                ? [...current.vegetableIds, ingredient.id]
                                : current.vegetableIds.filter((id) => id !== ingredient.id)
                            }))}
                          />
                          <span>{ingredient.name}</span><small>{money(ingredient.pricePaise)}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="custom-submit">
                    <label className="quantity-control">Qty
                      <input type="number" min="1" max="10" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10, Number(event.target.value))))} />
                    </label>
                    <button className="button button-orange" type="submit">Add your creation <span aria-hidden="true">↗</span></button>
                  </div>
                </form>
              </div>
            </section>

            <section className="checkout-section" id="bag">
              <div className="checkout-grid">
                <div className="section-heading checkout-heading">
                  <div><p className="eyebrow">THE GOOD STUFF</p><h2>Your <em>bag.</em></h2></div>
                  <p>{cart.length ? `${cart.length} pizza${cart.length === 1 ? "" : "s"}, made your way.` : "A great pizza is just a few choices away."}</p>
                </div>
                <div className="bag-card">
                  {!cart.length && <div className="empty-bag"><span>✳</span><p>Your bag is taking a little breather.</p><a className="text-link" href="#menu">Find something delicious →</a></div>}
                  {cart.map((item, index) => {
                    const linePrice = [item.baseId, item.sauceId, item.cheeseId, ...item.vegetableIds]
                      .map((id) => ingredientById.get(id)?.pricePaise || 0)
                      .reduce((sum, price) => sum + price, 0) * item.quantity;
                    return <div className="bag-item" key={`${item.name}-${index}`}>
                      <div className="bag-item-mark">P</div>
                      <div className="bag-item-info"><strong>{item.name}</strong><small>{[item.baseId, item.sauceId, item.cheeseId, ...item.vegetableIds].map((id) => ingredientById.get(id)?.name).filter(Boolean).join(" · ")}</small></div>
                      <label className="bag-quantity" aria-label={`Quantity of ${item.name}`}>
                        <button type="button" onClick={() => item.quantity <= 1 ? setCart((current) => current.filter((_, itemIndex) => itemIndex !== index)) : updateCartItem(index, { quantity: item.quantity - 1 })}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" disabled={item.quantity >= 10} onClick={() => updateCartItem(index, { quantity: item.quantity + 1 })}>+</button>
                      </label>
                      <strong className="bag-line-price">{money(linePrice)}</strong>
                      <button className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                    </div>;
                  })}
                  <div className="bag-total"><span>Subtotal <small>Taxes included</small></span><strong>{money(cartTotal)}</strong></div>
                  {checkoutOrder?.checkout?.mode === "demo" && checkoutOrder.status === "awaiting_payment" && (
                    <div className="demo-payment">
                      <strong>Local demo payment</strong>
                      <p>No money is charged. This assessment demo marks the test order as paid.</p>
                      <button className="button button-orange" disabled={busy} onClick={completeDemoPayment}>Simulate successful payment</button>
                      <button className="text-link" disabled={busy} onClick={cancelPendingOrder}>Cancel test order</button>
                    </div>
                  )}
                  {cart.length > 0 && <button className="button button-dark checkout-button" disabled={busy} onClick={startCheckout}>
                    {busy ? "One moment…" : "Continue to secure checkout"} <span aria-hidden="true">↗</span>
                  </button>}
                  <p className="checkout-footnote">🔒 Secure checkout · Payment in Indian rupees</p>
                </div>
                <div className="auth-card" id="account">
                  <div className="auth-card-top"><span className="auth-icon">✳</span><span>{user ? "YOUR STUDIO ACCOUNT" : "A SEAT AT OUR TABLE"}</span></div>
                  {user ? (
                    <div className="account-summary">
                      <h3>Good to see you, {user.username}.</h3>
                      <p>{user.email}</p>
                      <p className={user.emailVerified ? "verified-label" : "unverified-label"}>
                        {user.emailVerified ? "✓ Email verified" : "Verify your email to place an order"}
                      </p>
                      {!user.emailVerified && <button className="text-link" onClick={() => api("/api/auth/verify-resend", { method: "POST", body: { email: user.email } }).then((result) => {
                        setNotice(result.message);
                        setVerificationLink(result.developmentLink || "");
                      }).catch((requestError) => setError(requestError.message))}>Resend verification email</button>}
                      <a className="text-link" href="#orders">See your orders ↓</a>
                    </div>
                  ) : (
                    <AuthForm
                      mode={visibleAuthMode}
                      setMode={setAuthMode}
                      onSubmit={handleAuth}
                      busy={busy}
                      isAdmin={false}
                      resetToken={resetPasswordToken}
                    />
                  )}
                </div>
              </div>
            </section>

            <section className="section tracking-section" id="orders">
              <div className="section-heading">
                <div><p className="eyebrow">FROM OUR OVEN TO YOUR DOOR</p><h2>Follow your <em>order.</em></h2></div>
                <p>We’ll keep you in the loop<br />with every delicious step.</p>
              </div>
              {!user ? <p className="tracking-empty">Sign in to see your recent orders and their progress.</p> : orders.length ? (
                <div className="order-list">{orders.map((order) => <OrderCard key={order._id} order={order} onPay={resumePayment} onCancel={cancelOrder} busy={busy} />)}</div>
              ) : <p className="tracking-empty">No orders just yet. Your first slice is waiting.</p>}
            </section>

            <section className="closing-banner"><div><p className="eyebrow">MADE FOR YOUR KIND OF NIGHT</p><h2>Good food.<br /><em>Good mood.</em></h2></div><a className="button button-light" href="#build">Make it yours <span>↗</span></a><span className="closing-star">✳</span></section>
          </>
        )}
      </main>
      <footer className="site-footer"><Link className="brand brand-footer" to="/"><span className="brand-mark">P</span><span>pizza<span className="brand-accent">studio</span><small>FRESH, YOUR WAY</small></span></Link><span>Good food. Made your way.</span><span>OIBSIP · Web Development Level 3</span></footer>
    </div>
  );
}

function AuthForm({ mode, setMode, onSubmit, busy, isAdmin, resetToken }) {
  const heading = {
    login: isAdmin ? "Admin sign in" : "Welcome back.",
    register: "Join the table.",
    forgot: "Forgot your password?",
    verify: "Check your inbox.",
    reset: "Set a new password."
  }[mode] || "Welcome back.";
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h3>{heading}</h3>
      {mode === "register" && <label>Your name<input name="username" required minLength="2" maxLength="40" autoComplete="username" placeholder="How should we call you?" /></label>}
      {(mode === "register" || mode === "forgot" || mode === "verify") && <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>}
      {mode === "login" && <label>{isAdmin ? "Admin email" : "Username or email"}<input name={isAdmin ? "email" : "identifier"} required autoComplete={isAdmin ? "username" : "username"} placeholder={isAdmin ? "admin@example.com" : "Your username or email"} /></label>}
      {(mode === "register" || mode === "login" || mode === "reset") && (
        <label>{mode === "reset" ? "New password" : "Password"}
          <input name="password" type="password" required minLength={mode === "login" ? undefined : 10} maxLength="128" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 10 characters" />
          {mode !== "login" && <small className="input-hint">Use a letter, a number, and a symbol.</small>}
        </label>
      )}
      {mode === "reset" && !resetToken && <p className="form-note">The reset link is missing. Request a fresh one below.</p>}
      <button className="button button-orange auth-submit" disabled={busy || (mode === "reset" && !resetToken)}>{busy ? "One moment…" : mode === "register" ? "Create your account" : mode === "forgot" ? "Send reset link" : mode === "verify" ? "Resend verification email" : mode === "reset" ? "Update password" : "Sign in"} <span>↗</span></button>
      <div className="auth-links">
        {mode === "login" && !isAdmin && <><button type="button" onClick={() => setMode("register")}>Create an account</button><button type="button" onClick={() => setMode("forgot")}>Forgot password?</button></>}
        {mode !== "login" && <button type="button" onClick={() => setMode("login")}>Back to sign in</button>}
      </div>
      {isAdmin && <p className="form-note">Admin accounts are created by the server operator.</p>}
    </form>
  );
}

function OrderCard({ order, onPay, onCancel, busy }) {
  const progress = ["order_received", "in_kitchen", "out_for_delivery", "delivered"];
  return (
    <article className="order-card">
      <div className="order-card-header"><div><span className="eyebrow">ORDER #{String(order._id).slice(-8).toUpperCase()}</span><strong>{statusLabels[order.status] || order.status}</strong></div><strong>{money(order.totalPaise)}</strong></div>
      <p>{order.items.map((item) => `${item.quantity} × ${item.base.name} pizza`).join(" · ")}</p>
      <div className="order-progress">{progress.map((status, index) => (
        <span key={status} className={progress.indexOf(order.status) >= index ? "progress-step progress-active" : "progress-step"}>
          <i>{index + 1}</i>{statusLabels[status]}
        </span>
      ))}</div>
      {order.status === "awaiting_payment" && <p className="form-note">Finish payment from your bag to send this order to the kitchen.</p>}
      {order.status === "awaiting_payment" && <div className="order-actions">
        <button className="button button-orange button-small" disabled={busy} onClick={() => onPay(order)}>Continue to payment ↗</button>
        <button className="text-link" disabled={busy} onClick={() => onCancel(order)}>Cancel order</button>
      </div>}
      {order.status === "cancelled" && <p className="form-note">This unpaid order was cancelled.</p>}
    </article>
  );
}

function AdminPage({ user, authMode, onAuth, busy, setAuthMode, inventory, setInventory, orders, saveInventory, advanceOrder }) {
  if (!user) return (
    <section className="admin-login section">
      <p className="eyebrow">STAFF ACCESS</p><h1>Studio <em>control room.</em></h1>
      <p>Sign in with the admin account configured by the server operator.</p>
      <div className="auth-card"><AuthForm mode={authMode === "reset" || authMode === "forgot" ? "login" : authMode} setMode={setAuthMode} onSubmit={onAuth} busy={busy} isAdmin /></div>
    </section>
  );
  if (user.role !== "admin") return <section className="admin-login section"><p className="eyebrow">STAFF ACCESS</p><h1>Admin access <em>only.</em></h1><p>Your account does not have the admin role. Sign out and use the admin account.</p></section>;

  return (
    <section className="admin-dashboard section">
      <div className="section-heading"><div><p className="eyebrow">PIZZA STUDIO ADMIN</p><h1>Control <em>room.</em></h1></div><span className="admin-badge">SIGNED IN AS ADMIN</span></div>
      <div className="admin-metrics">
        <div><span>ACTIVE INGREDIENTS</span><strong>{inventory.filter((item) => item.active).length}</strong></div>
        <div><span>ORDERS IN VIEW</span><strong>{orders.length}</strong></div>
        <div><span>LOW-STOCK ITEMS</span><strong>{inventory.filter((item) => item.active && item.stock < item.lowStockThreshold).length}</strong></div>
      </div>
      <div className="admin-block">
        <div className="section-heading compact-heading"><div><p className="eyebrow">KEEP THE GOOD STUFF IN STOCK</p><h2>Inventory.</h2></div></div>
        <div className="inventory-table-wrap"><table className="inventory-table">
          <thead><tr><th>Ingredient</th><th>Category</th><th>In stock</th><th>Alert at</th><th>Available</th><th /></tr></thead>
          <tbody>{inventory.map((item) => <tr key={item._id} className={item.active && item.stock < item.lowStockThreshold ? "low-stock-row" : ""}>
            <td><strong>{item.name}</strong>{item.active && item.stock < item.lowStockThreshold && <small>Low stock</small>}</td>
            <td>{item.category}</td>
            <td><input aria-label={`${item.name} stock`} type="number" min="0" max="100000" value={item.stock} onChange={(event) => setInventory((current) => current.map((row) => row._id === item._id ? { ...row, stock: event.target.value } : row))} /></td>
            <td><input aria-label={`${item.name} low stock threshold`} type="number" min="0" max="100000" value={item.lowStockThreshold} onChange={(event) => setInventory((current) => current.map((row) => row._id === item._id ? { ...row, lowStockThreshold: event.target.value } : row))} /></td>
            <td><input aria-label={`${item.name} availability`} type="checkbox" checked={item.active} onChange={(event) => setInventory((current) => current.map((row) => row._id === item._id ? { ...row, active: event.target.checked } : row))} /></td>
            <td><button className="button button-small button-dark" onClick={() => saveInventory(item)}>Save</button></td>
          </tr>)}</tbody>
        </table></div>
      </div>
      <div className="admin-block">
        <div className="section-heading compact-heading"><div><p className="eyebrow">MAKE EVERY ORDER A GOOD ONE</p><h2>Order board.</h2></div></div>
        {!orders.length && <p className="muted">No orders yet.</p>}
        <div className="admin-order-list">{orders.map((order) => (
          <article className="admin-order-card" key={order._id}>
            <div><span className="eyebrow">#{String(order._id).slice(-8).toUpperCase()} · {order.userId?.username || "Customer"}</span><strong>{statusLabels[order.status] || order.status}</strong><small>{order.userId?.email}</small></div>
            <div><strong>{money(order.totalPaise)}</strong><small>{order.items.map((item) => `${item.quantity} × ${item.base.name}`).join(", ")}</small></div>
            {statusNext[order.status] && <button className="button button-orange button-small" onClick={() => advanceOrder(order)}>Mark {statusLabels[statusNext[order.status]]} ↗</button>}
          </article>
        ))}</div>
      </div>
    </section>
  );
}

export default App;
