## shiny packages
suppressPackageStartupMessages(library("shiny"))
suppressPackageStartupMessages(library("shinyjs"))
suppressPackageStartupMessages(library("shinydashboard"))
suppressPackageStartupMessages(library("htmltools"))

# Define UI ----
ui <- fluidPage(
  shinyjs::useShinyjs(),
  
  ## UI login page
  div(
    id = "login_page",
    
    fluidRow(
      column(4, 
             offset = 4,
             
             wellPanel(
               class = "login-panel",
               
               h2("Welcome to Login Page!"),
               
               textInput(inputId = "login_email", 
                         label = HTML('Email (<span style="color: red;">required</span>)'), 
                         value = ""),
               
               textInput(inputId = "login_affil", 
                         label = "Affiliation (optional)", value = "")
             ),
             column(12,
                    style = "text-align: right;",
                    actionButton(inputId = "login_btn", 
                                 label = "Go to app")
             )
      )
    )
  ),
  
  ## UI main page
  shinyjs::hidden(
    div(
      id = "ui_main_page",
      
      dashboardPage(
        skin = "blue",
        
        ## Dashboard header
        dashboardHeader(title = tagList(icon("chart-line"), "GAM tool"),
                        tags$li(class = "dropdown",
                                style = "margin-right: 10px; margin-top: 8px;",
                                actionButton(inputId = "login_admin_btn",
                                             label = "Admin",
                                             icon = icon("user-shield")),
                                actionButton(inputId = "logout_btn",
                                             label = "Logout",
                                             icon = icon("sign-out-alt"))
                        )),
        
        ## Dashboard sidebar
        dashboardSidebar(
          sidebarMenu(
            id = "tabs", 
            menuItem("General information", 
                     tabName = "ginfo", 
                     icon = icon("info-circle")),
            menuItem("GAM manual", 
                     tabName = "gam_manual",
                     icon = icon("project-diagram")),
            menuItem("GAM previous", 
                     tabName = "gam_previous", 
                     icon = icon("history")),
            menuItem("Discussion of statistics", 
                     tabName = "discussion_of_statistics", 
                     icon = icon("comments"))
          )
        ),
        
        ## Dashboard body
        dashboardBody(
          
        )
      )
    )
  )
)

# Server part ----
server <- function(input, output, session) {

  ### Guest login button
  observeEvent(input$login_btn, {
      shinyjs::hide(id = "login_page")
      shinyjs::show(id = "ui_main_page")
  })
  
  ### Guest logout button
  observeEvent(input$logout_btn, {
    shinyjs::show(id = "login_page")
    shinyjs::hide(id = "ui_main_page")
  })
}

# Run the app ----
shinyApp(ui = ui,
         server = server)
